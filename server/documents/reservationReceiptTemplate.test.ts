import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import type {GlobalSettings} from '../../src/types';
import {INITIAL_SETTINGS} from '../../src/services/demoSeed';
import {PDFDocument} from 'pdf-lib';
import {inspectPdfLayout} from '../workflow/documentQuality';
import {RESERVATION_RECEIPT_TEMPLATE_FIELDS} from '../../src/utils/reservationReceiptTemplateFields';
import {studioSampleProcess} from '../../src/utils/studioRuntimePreview';
import {readProcessFormPdfById} from '../integrations/googleDriveArchive';
import {renderReservationArchivePdf,renderReservationReceiptTemplate,reservationReceiptTemplate,reservationReceiptTemplateValues} from './reservationReceiptTemplate';

const model={templateId:'private_fixture_model',contentSha256:'f'.repeat(64),version:2};
const responseProcess=()=>{
 const p=studioSampleProcess();
 p.defesa.departmentResponse={decision:'UNAVAILABLE',revision:2,respondedBy:'gestor@example.invalid',
  respondedAt:'2026-11-03T19:00:00Z',startAt:'2026-11-08T15:00:00Z',endAt:'2026-11-08T16:30:00Z',
  local:'Sala original',receiptBody:'Título: Título original\nAutor: Autor Um\nAutor: Autora Dois'};
 return p;
};
const settingsWith=(variables: string[], driveFileId=model.templateId):GlobalSettings => ({...INITIAL_SETTINGS,documentModels:{
 COMPROVANTES_RESERVA:{id:'receipt',type:'COMPROVANTES_RESERVA',label:'Comprovante',fileName:'fixture.docx',templateContentText:'',
  driveFileId,driveFileUrl:'',uploadedAt:'2026-11-01',uploadedBy:'fixture',contentSha256:model.contentSha256,activeVersion:model.version,variables},
}});

test('ativação do DOCX requer uma versão publicada e todos os marcadores canônicos',()=>{
 assert.equal(reservationReceiptTemplate(settingsWith(['{{PROTOCOLO}}'])),undefined);
 assert.equal(reservationReceiptTemplate(settingsWith([...RESERVATION_RECEIPT_TEMPLATE_FIELDS],'local_model_fixture')),undefined);
 assert.equal(reservationReceiptTemplate(settingsWith([...RESERVATION_RECEIPT_TEMPLATE_FIELDS,'{{CPF}}'])),undefined);
 assert.deepEqual(reservationReceiptTemplate(settingsWith(RESERVATION_RECEIPT_TEMPLATE_FIELDS.map(key=>`{{${key}}}`))),model);
});

test('comprovante DOCX usa os fatos registrados e converte os bytes exatos verificados',async()=>{
 const process=responseProcess();
 const values=reservationReceiptTemplateValues(process);
 assert.equal(values.TITULO,'Título original');
 assert.equal(values.ALUNOS,'Autor Um e Autora Dois');
 assert.equal(values.DEFESA_LOCAL,'Sala original');
 assert.equal(values.RESERVA_RESULTADO,'Reserva recusada');
 assert.equal(values.RESPONSAVEL_RESERVA,'gestor@example.invalid');
 const bytes=Buffer.from('synthetic docx'),pdf=Buffer.from('%PDF-1.7 synthetic');
 const ports={
   read:async(input:unknown)=>{assert.deepEqual(input,{type:'COMPROVANTES_RESERVA',rootFolderId:'fixture_root_id',fileId:model.templateId,contentSha256:model.contentSha256,accessToken:'fixture-token'});return bytes;},
   folder:async()=> 'fixture_temporary_folder',
   render:async(input:{verifiedDocxBytes?:Buffer;replacements:Record<string,unknown>;reservationReceiptLayout?:boolean})=>{
    assert.equal(input.verifiedDocxBytes,bytes);assert.equal(input.reservationReceiptLayout,true);
    assert.deepEqual(input.replacements,values);
    return {pdf,fileName:'fixture.pdf',sourceFileId:model.templateId,sourceMimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document' as const,convertedFromDocx:true,replacementsChanged:9,unresolvedMarkers:[],tabCount:1,documentText:Object.values(values).join('\n')};
   },
   inspect:async()=>({pages:1,issues:[],extractedCharacters:250,requiresVisualReview:true as const}),
 };
 assert.equal(await renderReservationReceiptTemplate(process,model,'fixture-token','fixture_root_id',ports),pdf);
 await assert.rejects(renderReservationReceiptTemplate(process,model,'fixture-token','fixture_root_id',{
   ...ports,render:async input=>({...await ports.render(input),documentText:'Resultado não confirmado'}),
 }),/não confirmou/);
 await assert.rejects(renderReservationReceiptTemplate(process,model,'fixture-token','fixture_root_id',{
   ...ports,read:async()=>{throw Error('hash divergente');},render:async()=>assert.fail('Não converter bytes não validados.'),
 }),/hash divergente/);
});

test('uma tentativa recupera somente o PDF privado da revisão e hash registrados',async t=>{
 const id='fixture_reserved_id',pdf=Buffer.from('%PDF-1.7 synthetic');
 const hash=createHash('sha256').update(pdf).digest('hex');
 let metadataVersion='2',missing=false;
 t.mock.method(globalThis,'fetch',async(input:string,init?:RequestInit)=>{
  const url=new URL(String(input));
  assert.equal(init?.method??'GET','GET');
  if(url.pathname.endsWith('/permissions'))return Response.json({permissions:[{type:'user',role:'owner'}]});
  if(url.searchParams.get('fields')==='id')return missing?new Response(null,{status:404}):Response.json({id});
  if(url.searchParams.get('alt')==='media')return new Response(new Uint8Array(pdf));
  return Response.json({id,name:'arquivo.pdf',mimeType:'application/pdf',trashed:false,appProperties:{
   portal:'portal-tcc',portalProcessId:'p',formType:'CONFIRMACAO_LOCAL',formVersion:metadataVersion,sha256:hash,
  }});
 });
 const expected={processId:'p',formType:'CONFIRMACAO_LOCAL',formVersion:2,allowedHashes:[hash]};
 assert.deepEqual(await readProcessFormPdfById('fixture-token',id,expected),{pdf,fileName:'arquivo.pdf',sha256:hash});
 await assert.rejects(readProcessFormPdfById('fixture-token',id,{...expected,allowedHashes:[]}),/tentativa registrada/);
 metadataVersion='3';
 await assert.rejects(readProcessFormPdfById('fixture-token',id,expected),/versão do formulário/);
 missing=true;
 assert.equal(await readProcessFormPdfById('fixture-token',id,expected),null);
});

test('o PDF exportado precisa conter o texto obrigatório extraível',async()=>{
 const document=await PDFDocument.create();
 document.addPage().drawText('Reserva recusada');
 const pdf=Buffer.from(await document.save());
 assert.deepEqual((await inspectPdfLayout(pdf,{requiredText:['Reserva recusada']})).issues,[]);
 const missing=await inspectPdfLayout(pdf,{requiredText:['Reserva confirmada']});
 assert.ok(missing.issues.some(issue=>issue.code==='REQUIRED_TEXT_MISSING'&&issue.severity==='ERROR'));
});

test('arquivamento volta ao PDF do Portal se a versão publicada falhar',async()=>{
 const process=responseProcess();
 process.defesa.local='Sala original';
 const selected=await renderReservationArchivePdf(process,model,INITIAL_SETTINGS,'fixture-token','fixture_root_id',async()=>{throw Error('modelo alterado');});
 assert.equal(selected.source,'CANONICAL');
 const checked=await inspectPdfLayout(selected.pdf,{requiredText:['Reserva recusada','Título original','Sala original']});
 assert.equal(checked.pages,1);
 assert.equal(checked.issues.some(issue=>issue.severity==='ERROR'),false,JSON.stringify(checked.issues));
});


test('receipt heading alignment preserves other paragraphs and targets the correct tab',async()=>{
 const {buildReservationReceiptTitleStyles}=await import('../integrations/googleDocsRenderer');
 const paragraph=(text:string,startIndex:number)=>({startIndex,endIndex:startIndex+text.length+1,paragraph:{elements:[{textRun:{content:text+'\n'}}]}});
 const document={tabs:[{documentTab:{body:{content:[paragraph('COMPROVANTE DE RESERVA',1),paragraph('Título do trabalho',24)]}},tabProperties:{tabId:'receipt-tab'}}]};
 assert.deepEqual(buildReservationReceiptTitleStyles(document),[{updateParagraphStyle:{range:{startIndex:1,endIndex:24,tabId:'receipt-tab'},paragraphStyle:{alignment:'CENTER'},fields:'alignment'}}]);
 for(const title of ['COMPROVANTE DE INDISPONIBILIDADE','Comprovante de deferimento','Comprovante de indeferimento'])assert.equal(buildReservationReceiptTitleStyles({body:{content:[paragraph(title,1)]}}).length,1);
});
