import assert from 'node:assert/strict';
import test from 'node:test';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import {
  buildGoogleDocsReplacementRequests,
  extractGoogleDriveFileId,
  findUnresolvedTemplateMarkers,
  renderGoogleDriveTemplateToPdf,
  saveReviewedAta,
  exportReviewedAta
} from './googleDocsRenderer';

const jsonResponse = (value: unknown, status = 200) => new Response(JSON.stringify(value), {
  status,
  headers: { 'Content-Type': 'application/json' }
});

test('extrai IDs de links Google Docs, Drive e ID puro', () => {
  assert.equal(extractGoogleDriveFileId('https://docs.google.com/document/d/1AbCdEfGhIjKlMnOp/edit'), '1AbCdEfGhIjKlMnOp');
  assert.equal(extractGoogleDriveFileId('https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/view'), '1AbCdEfGhIjKlMnOp');
  assert.equal(extractGoogleDriveFileId('1AbCdEfGhIjKlMnOp'), '1AbCdEfGhIjKlMnOp');
  assert.throws(() => extractGoogleDriveFileId('https://example.com/modelo.docx'), /inválido/i);
});

test('gera substituições somente para marcadores explícitos e inclui todas as abas', () => {
  const requests = buildGoogleDocsReplacementRequests({ NOME_ALUNO: 'Ana', VAZIO: null }, ['t.0', 't.1']);
  assert.equal(requests.length, 10);
  assert.deepEqual(requests[0].replaceAllText.tabsCriteria, { tabIds: ['t.0', 't.1'] });
  assert.equal(requests[0].replaceAllText.containsText.text, '<<NOME_ALUNO>>');
  assert.equal(requests[4].replaceAllText.containsText.text, '-NOME_ALUNO-');
  assert.equal(requests[5].replaceAllText.replaceText, '');
  assert.throws(() => buildGoogleDocsReplacementRequests({ '<marcador><invalido>': 'x' }), /Variável de modelo inválida/);
});

test('detecta marcadores restantes sem confundir títulos comuns', () => {
  const document = { body: { content: [
    { paragraph: { elements: [{ textRun: { content: 'ATA DE DEFESA — <<CAMPO_DESCONHECIDO>>' } }] } },
    { paragraph: { elements: [{ textRun: { content: 'Parecer: -CAMPO_11-' } }] } }
  ] } };
  assert.deepEqual(findUnresolvedTemplateMarkers(document), ['<<CAMPO_DESCONHECIDO>>', '-CAMPO_11-']);
  assert.deepEqual(findUnresolvedTemplateMarkers({ body: { content: [{ textRun: { content: 'ATA DE DEFESA' } }] } }), []);
  assert.deepEqual(findUnresolvedTemplateMarkers({body:{content:[{textRun:{content:'Protocolo PILOTO-AST'}},{textRun:{content:'EN-1; TCC-2026-0001. Campo: -CAMPO_11-.'}}]}}),['-CAMPO_11-']);
});

test('copia Google Doc nativo, mescla, exporta PDF e remove temporário', async () => {
  const calls: Array<{ url: string; method: string; body?: string }> = [];
  const fetchImpl = (async (resource: URL | RequestInfo, init: RequestInit = {}) => {
    const url = String(resource);
    const method = String(init.method || 'GET');
    calls.push({ url, method, body: typeof init.body === 'string' ? init.body : undefined });
    if (url.includes('/files/1AbCdEfGhIjKlMnOp?fields=')) return jsonResponse({ id: '1AbCdEfGhIjKlMnOp', name: 'Ata.docx', mimeType: 'application/vnd.google-apps.document', capabilities: { canCopy: true } });
    if (url.includes('/copy?')) return jsonResponse({ id: 'tmpGoogleDoc12345' });
    if (url.includes('/documents/tmpGoogleDoc12345?')) return jsonResponse({ documentId: 'tmpGoogleDoc12345', revisionId: 'rev-1', tabs: [{ tabProperties: { tabId: 't.0' } }] });
    if (url.endsWith('/documents/tmpGoogleDoc12345:batchUpdate')) return jsonResponse({ documentId: 'tmpGoogleDoc12345', replies: [{ replaceAllText: { occurrencesChanged: 1 } }] });
    if (url.includes('/export?')) return new Response(Buffer.from('%PDF-1.4\nportal'));
    if (url.includes('/files/tmpGoogleDoc12345?supportsAllDrives=true') && method === 'DELETE') return new Response(null, { status: 204 });
    throw new Error(`Chamada inesperada: ${method} ${url}`);
  }) as typeof fetch;

  const result = await renderGoogleDriveTemplateToPdf({
    accessToken: 'token-for-test-only',
    templateUrlOrId: '1AbCdEfGhIjKlMnOp',
    replacements: { NOME_ALUNO: 'Ana Souza' },
    outputName: 'TCC-2026-0001__ANA__ATA.pdf',
    fetchImpl
  });

  assert.ok(result.pdf.subarray(0, 5).equals(Buffer.from('%PDF-')));
  assert.equal(result.fileName, 'TCC-2026-0001__ANA__ATA.pdf');
  assert.equal(result.convertedFromDocx, false);
  assert.equal(result.replacementsChanged, 1);
  assert.equal(calls.filter(call => call.url.includes('/copy?')).length, 1);
  assert.equal(calls.filter(call => call.method === 'DELETE').length, 1);
  assert.equal(calls.filter(call => call.url.includes('/files/1AbCdEfGhIjKlMnOp?') && ['PATCH', 'DELETE'].includes(call.method)).length, 0);

  calls.length=0;
  const retained=await renderGoogleDriveTemplateToPdf({
    accessToken:'token-for-test-only',templateUrlOrId:'1AbCdEfGhIjKlMnOp',
    replacements:{NOME_ALUNO:'Ana Souza'},retainAtaPreview:true,fetchImpl,
  });
  assert.equal(retained.previewFileId,'tmpGoogleDoc12345');
  assert.equal(JSON.parse(calls.find(call=>call.url.includes('/copy?'))?.body||'{}').appProperties.lifecycle,'ata-preview');
  assert.ok(calls.every(call=>call.method!=='DELETE'));
});

test('converte DOCX em Google Doc temporário antes da exportação', async () => {
  const calls: Array<{ url: string; method: string }> = [];
  const fetchImpl = (async (resource: URL | RequestInfo, init: RequestInit = {}) => {
    const url = String(resource);
    const method = String(init.method || 'GET');
    calls.push({ url, method });
    if (url.includes('/files/1DocxTemplate2345?fields=')) return jsonResponse({ id: '1DocxTemplate2345', name: 'Termo.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', capabilities: { canCopy: true, canDownload: true } });
    if (url.includes('/files/1DocxTemplate2345?alt=media')) return new Response(Buffer.from('PK\u0003\u0004mock-docx'));
    if (url.includes('/upload/drive/v3/files?uploadType=multipart')) return jsonResponse({ id: 'tmpConvertedDoc123' });
    if (url.includes('/documents/tmpConvertedDoc123?')) return jsonResponse({ documentId: 'tmpConvertedDoc123', revisionId: 'rev-docx' });
    if (url.includes('/export?')) return new Response(Buffer.from('%PDF-1.4\nconverted'));
    if (url.includes('/files/tmpConvertedDoc123?supportsAllDrives=true') && method === 'DELETE') return new Response(null, { status: 204 });
    throw new Error(`Chamada inesperada: ${method} ${url}`);
  }) as typeof fetch;

  const result = await renderGoogleDriveTemplateToPdf({
    accessToken: 'token-for-test-only',
    templateUrlOrId: '1DocxTemplate2345',
    replacements: {},
    fetchImpl
  });
  assert.equal(result.convertedFromDocx, true);
  assert.equal(result.fileName, 'Termo.pdf');
  assert.equal(calls.some(call => call.url.includes('/upload/drive/v3/files?uploadType=multipart')), true);
  assert.equal(calls.filter(call => call.method === 'DELETE').length, 1);
});

test('a conversão usa somente o DOCX cujos bytes já foram verificados', async () => {
  const sourceId='sourceDocxFixture123';
  const verifiedDocxBytes=Buffer.from([80,75,3,4,1,2,3]);
  const fetchImpl=(async (resource: URL | RequestInfo, init: RequestInit = {}) => {
    const url=String(resource);
    if (url.includes('/files/'+sourceId+'?fields=')) return jsonResponse({id:sourceId,name:'Comprovante.docx',mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});
    if (url.includes('/upload/drive/v3/files?')) {
      assert.ok(Buffer.isBuffer(init.body)&&init.body.includes(verifiedDocxBytes));
      return jsonResponse({id:'convertedReceiptFixture'});
    }
    if (url.includes('/documents/convertedReceiptFixture?')) return jsonResponse({documentId:'convertedReceiptFixture',revisionId:'fixture'});
    if (url.includes('/files/convertedReceiptFixture/export?')) return new Response(Buffer.from('%PDF-1.4 fixture'));
    if (url.includes('/files/convertedReceiptFixture?')&&init.method==='DELETE') return new Response(null,{status:204});
    throw new Error('Unexpected request '+url);
  }) as typeof fetch;
  const result=await renderGoogleDriveTemplateToPdf({accessToken:'fixture',templateUrlOrId:sourceId,verifiedDocxBytes,replacements:{},fetchImpl});
  assert.equal(result.convertedFromDocx,true);
});

test('normaliza o cabeçalho após a revisão do corpo usando a revisão atual da cópia temporária',async()=>{
 const headings=['UNIVERSIDADE FEDERAL DO ESPÍRITO SANTO','CENTRO DE CIÊNCIAS DA SAÚDE','CURSO DE GRADUAÇÃO EM ENFERMAGEM E OBSTETRÍCIA'];
 const body=['ATA DA DEFESA','Título: Cuidados na Saúde da Mulher','Parecer: Trabalho aprovado.','Comissão de Trabalho de Conclusão de Curso','Departamento de Enfermagem','Curso de Enfermagem e Obstetrícia — CCS/UFES'];
 const original=[...headings,...body].join('\n')+'\n';
 let documentText=original,revision=1;
 const batches:any[]=[],calls:Array<{url:string;method:string}>=[];
 const readback=()=>{
  let index=1;
  return {documentId:'tmpGoogleDoc12345',revisionId:`rev-${revision}`,body:{content:documentText.match(/[^\n]*\n|[^\n]+$/g)!.map(text=>{
   const startIndex=index;index+=text.length;return {startIndex,endIndex:index,paragraph:{elements:[{startIndex,textRun:{content:text}}]}};
  })}};
 };
 const fetchImpl=(async(resource:URL|RequestInfo,init:RequestInit={})=>{
  const url=String(resource),method=String(init.method||'GET');calls.push({url,method});
  if(url.includes('/files/1AbCdEfGhIjKlMnOp?fields='))return jsonResponse({id:'1AbCdEfGhIjKlMnOp',name:'Ata',mimeType:'application/vnd.google-apps.document',capabilities:{canCopy:true}});
  if(url.includes('/copy?'))return jsonResponse({id:'tmpGoogleDoc12345'});
  if(url.includes('/documents/tmpGoogleDoc12345?'))return jsonResponse(readback());
  if(url.endsWith('/documents/tmpGoogleDoc12345:batchUpdate')){
   const batch=JSON.parse(String(init.body));assert.equal(batch.writeControl.requiredRevisionId,`rev-${revision}`);batches.push(batch);
   let indexed='\n'+documentText;
   for(const request of batch.requests){
    if(request.deleteContentRange){const {startIndex,endIndex}=request.deleteContentRange.range;indexed=indexed.slice(0,startIndex)+indexed.slice(endIndex);}
    if(request.insertText){const {location,text}=request.insertText;indexed=indexed.slice(0,location.index)+text+indexed.slice(location.index);}
   }
   documentText=indexed.slice(1);revision++;return jsonResponse({documentId:'tmpGoogleDoc12345',replies:[]});
  }
  if(url.includes('/export?')){assert.equal(documentText,original);return new Response(Buffer.from('%PDF-1.4\nheader-normalized'));}
  if(url.includes('/files/tmpGoogleDoc12345?supportsAllDrives=true')&&method==='DELETE')return new Response(null,{status:204});
  throw new Error(`Chamada inesperada: ${method} ${url}`);
 }) as typeof fetch;
 const result=await renderGoogleDriveTemplateToPdf({accessToken:'token-for-test-only',templateUrlOrId:'1AbCdEfGhIjKlMnOp',replacements:{},institutionalCrestUrl:'https://portal.example/national-arms.png',documentText:[...headings.map(text=>text.toLocaleLowerCase('pt-BR')),...body].join('\n'),fetchImpl});
 assert.equal(batches.length,2);
 assert.equal(batches[1].requests.filter((request:any)=>request.updateParagraphStyle?.paragraphStyle.alignment==='CENTER').length,3);
 assert.equal(result.documentText,original.trimEnd());
 assert.equal(calls.some(call=>call.url.includes('/files/1AbCdEfGhIjKlMnOp?')&&['PATCH','DELETE'].includes(call.method)),false);
 assert.equal(calls.filter(call=>call.method==='DELETE').length,1);
});

test('salva a cópia já formatada e exporta dela o PDF numerado, sem carregar o modelo',async()=>{
  const previewId='previewAtaFormatada';
  const savedId='ataRevisadaFixture';
  const folderId='pastaPrivadaProcesso';
  const processId='processo-teste';
  const calls:string[]=[];
  const pdf=await PDFDocument.create();
  const font=await pdf.embedFont(StandardFonts.HelveticaBold);
  pdf.addPage().drawText('Ata revisada da defesa',{font,x:44,y:750,size:12});
  const pdfBytes=await pdf.save();
  let edited=false;
  const fetchImpl=(async(resource:URL|RequestInfo,init:RequestInit={})=>{
    const url=String(resource), method=init.method||'GET';
    calls.push(`${method} ${url}`);
    if(url.includes(`/files/${previewId}?fields=`)){
      return jsonResponse({id:previewId,mimeType:'application/vnd.google-apps.document',appProperties:{portal:'portal-tcc',lifecycle:'ata-preview'}});
    }
    if(url.includes(`/files/${previewId}/copy?`)){
      const metadata=JSON.parse(String(init.body));
      assert.equal(metadata.name,'TCC - 00002 - ATA');
      assert.deepEqual(metadata.parents,[folderId]);
      assert.equal(metadata.appProperties.portalProcessId,processId);
      return jsonResponse({id:savedId});
    }
    if(url.includes(`/documents/${savedId}?`)){
      return jsonResponse({
        documentId:savedId,revisionId:'revisao-1',body:{content:[{startIndex:1,endIndex:25,paragraph:{paragraphStyle:{alignment:'CENTER'},elements:[{textRun:{content:edited?'Ata revisada da defesa\n':'Ata inicial da defesa\n',textStyle:{bold:true}}}]}}]},
      });
    }
    if(url.endsWith(`/documents/${savedId}:batchUpdate`)){
      const {requests,writeControl}=JSON.parse(String(init.body));
      assert.deepEqual(writeControl,{requiredRevisionId:'revisao-1'});
      assert.ok(requests.some(request=>request.updateTextStyle?.textStyle.bold===true));
      assert.ok(requests.every(request=>!request.replaceAllText&&!request.updateParagraphStyle));
      edited=true;
      return jsonResponse({documentId:savedId});
    }
    if(url.includes(`/files/${savedId}/export?`))return new Response(Buffer.from(pdfBytes));
    if(url.includes(`/files/${savedId}?`)){
      return jsonResponse({id:savedId,mimeType:'application/vnd.google-apps.document',appProperties:{portal:'portal-tcc',lifecycle:'ata-reviewed',portalProcessId:processId}});
    }
    throw new Error(`Requisição inesperada: ${method} ${url}`);
  }) as typeof fetch;

  assert.equal(await saveReviewedAta({accessToken:'test-only',previewFileId:previewId,folderId,processId,fileName:'TCC - 00002 - ATA.pdf',text:'Ata revisada da defesa',fetchImpl}),savedId);
  const exported=await exportReviewedAta('test-only',savedId,processId,fetchImpl);
  const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs');
  const task=getDocument({data:new Uint8Array(exported),useSystemFonts:true,verbosity:0});
  try{
    const page=await(await task.promise).getPage(1);
    const lines=(await page.getTextContent()).items.map(item=>'str'in item?item.str:'');
    assert.ok(lines.includes('Ata revisada da defesa'));
    assert.ok(lines.includes('1'));
  }finally{await task.destroy();}
  assert.equal(calls.filter(call=>call.includes('/copy?')).length,1);
  assert.equal(calls.filter(call=>call.includes(':batchUpdate')).length,1);
});

test('edição que excede uma página rejeita o salvamento e exclui só a cópia da tentativa',async()=>{
 const previewId='previewAtaPreservada',savedId='ataTentativaExcedente';
 const pdf=await PDFDocument.create();pdf.addPage().drawText('Ata integral',{x:43,y:740});pdf.addPage().drawText('Texto excedente preservado',{x:43,y:740});
 const bytes=Buffer.from(await pdf.save());
 let edited=false;const deleted:string[]=[];
 const fetchImpl=(async(resource:URL|RequestInfo,init:RequestInit={})=>{
  const url=String(resource);
  if(init.method==='DELETE'){deleted.push(url);return new Response(null,{status:204});}
  if(url.includes(`/files/${previewId}?fields=`))return jsonResponse({id:previewId,mimeType:'application/vnd.google-apps.document',appProperties:{portal:'portal-tcc',lifecycle:'ata-preview'}});
  if(url.includes(`/files/${previewId}/copy?`))return jsonResponse({id:savedId});
  if(url.includes(`/documents/${savedId}?`)){
   const text=edited?'Ata integral revisada':'Ata inicial';
   return jsonResponse({documentId:savedId,revisionId:'revision-current',body:{content:[{startIndex:1,endIndex:text.length+2,paragraph:{elements:[{textRun:{content:text+'\n'}}]}}]}});
  }
  if(url.endsWith(`/documents/${savedId}:batchUpdate`)){edited=true;return jsonResponse({documentId:savedId});}
  if(url.includes(`/files/${savedId}/export?`))return new Response(bytes);
  throw new Error('Unexpected request '+url);
 }) as typeof fetch;
 await assert.rejects(saveReviewedAta({accessToken:'test-only',previewFileId:previewId,folderId:'privateFixtureFolder',processId:'fixture-only',fileName:'Ata.pdf',text:'Ata integral revisada',fetchImpl}),/2 páginas.*nenhum conteúdo foi cortado/);
 assert.equal(edited,true);
 assert.equal(deleted.length,1);
 assert.ok(deleted[0].includes(savedId));assert.ok(!deleted[0].includes(previewId));
});
