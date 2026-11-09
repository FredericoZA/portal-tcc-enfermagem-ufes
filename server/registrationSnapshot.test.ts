import test from 'node:test';
import assert from 'node:assert/strict';
import {createRegistrationSnapshotPdf,prepareRegistrationSnapshot,renderRegistrationSnapshot,registrationSnapshotSections} from './documents/registrationSnapshot';
import {DEMO_PROCESSES,INITIAL_SETTINGS} from '../src/services/demoSeed';
import {DEFAULT_BRAND_KIT} from '../src/services/integrationStudioService';

async function pagesOf(bytes:Buffer){
 const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs');
 const task=getDocument({data:new Uint8Array(bytes),verbosity:0});const pdf=await task.promise;
 try{const pages=[];for(let i=1;i<=pdf.numPages;i++)pages.push(await(await pdf.getPage(i)).getTextContent());return pages;}finally{await task.destroy();}
}
test('registration snapshot groups one or two authors and retains human labels without duplicated canonical answers',()=>{
 const p=structuredClone(DEMO_PROCESSES[0]);p.aluno2=null;
 p.registrationAnswers={ALUNO_1_NOME:p.aluno1.nome,TITULO:p.titulo,LOCAL_ALTERNATIVO:'Sala',AREA_TEMATICA:'Saúde coletiva'};
 let sections=registrationSnapshotSections(p,INITIAL_SETTINGS);
 assert.equal(sections.filter(s=>s.title==='Aluno autor').length,1);
 assert.equal(sections.flatMap(s=>s.fields).filter(f=>f.value===p.aluno1.nome).length,1);
 assert.ok(sections.flatMap(s=>s.fields).some(f=>f.label==='Área temática'&&f.value==='Saúde coletiva'));
 assert.ok(!sections.flatMap(s=>s.fields).some(f=>/ALUNO_1|LOCAL_ALTERNATIVO/.test(f.label)));
 p.aluno2={...p.aluno1,nome:'Anne-Marie D’Ávila',email:'segunda@example.invalid'};
 sections=registrationSnapshotSections(p,INITIAL_SETTINGS);assert.equal(sections.filter(s=>s.title==='Aluno autor').length,2);assert.equal(sections.filter(s=>s.title==='Aluno autor')[1]?.fields[0].value,'Anne-Marie D’Ávila');
});

test('cópia nova do cadastro omite identificadores históricos diretos e perguntas antigas sem apagar a origem',async()=>{
 const p=structuredClone(DEMO_PROCESSES[0]);
 p.aluno1.matricula='HISTORICO-REGISTRO-001';p.orientador.siape='HISTORICO-REGISTRO-002';
 p.registrationAnswers={ALUNO_1_MATRICULA:p.aluno1.matricula,ORIENTADOR_SIAPE:p.orientador.siape,ALUNO_1_CPF:'HISTORICO-REGISTRO-003',CAMPO_ANTIGO:'HISTORICO-REGISTRO-004',AREA_TEMATICA:'Cuidado de enfermagem'};
 const settings=structuredClone(INITIAL_SETTINGS);
 settings.integrationStudio={
  schemaVersion:3,revision:1,savedAt:'2026-11-07T12:00:00Z',savedBy:'master@example.invalid',
  driveModelosFolderUrl:'',brandKit:structuredClone(DEFAULT_BRAND_KIT),documentDesigns:{},emailDesigns:{},formDesigns:{},
  matrixColumns:[],matrixRows:[],docTemplates:[],emailTemplates:[],workflowStages:[],auditTrail:[],
  formTemplates:[{id:'form-reserva-aluno',questions:[{id:'historical-registration',label:'CIAP antigo do docente',fieldKey:'CAMPO_ANTIGO',fieldType:'text',required:false}]}],
 };
 const before=structuredClone(p);
 const sections=registrationSnapshotSections(p,settings);
 assert.doesNotMatch(JSON.stringify(sections),/HISTORICO-REGISTRO|CIAP antigo|Matrícula|SIAPE/);
 const pages=await pagesOf(await createRegistrationSnapshotPdf(p,settings));
 assert.doesNotMatch(pages.flatMap(page=>page.items.map((item:any)=>item.str||'')).join(' '),/HISTORICO-REGISTRO|CIAP antigo|Matrícula|SIAPE/);
 assert.deepEqual(p,before);
});
test('registration PDF has brand identity and paginates very long answers inside the printable area',async()=>{
 const p=structuredClone(DEMO_PROCESSES[0]);p.registrationAnswers={AREA_TEMATICA:'Saúde coletiva '.repeat(700)};
 const pages=await pagesOf(await createRegistrationSnapshotPdf(p,INITIAL_SETTINGS));assert.ok(pages.length>2);
 const text=pages.flatMap(p=>p.items.map((i:any)=>i.str||'')).join(' ');
 assert.match(text,/UNIVERSIDADE FEDERAL DO ESPÍRITO SANTO/);assert.match(text,/CADASTRO INICIAL DE TCC/);assert.doesNotMatch(text,/ALUNO_1_NOME|NÃO CONFIGURAD/);
 for(const page of pages)for(const item of page.items as any[])if(item.str?.trim()){
  assert.ok(item.transform[5]>=29,`Text outside printable area: ${item.str}`);
  if(item.transform[5]<80)assert.match(item.str,/^(?:Comissão de Trabalho de Conclusão de Curso|Departamento de Enfermagem|Curso de Enfermagem e Obstetrícia — CCS\/UFES|Registro do cadastro inicial · Portal TCC|\d+ \/ \d+)$/,`Body overlaps footer: ${item.str}`);
 }
});

test('additional records have the same logo header, Unicode text and printable wrapped title',async()=>{
 const {createBrandedTextPdf}=await import('./documents/registrationSnapshot');
 const bytes=await createBrandedTextPdf({title:'Histórico e registro complementar de um formulário com título muito longo',protocol:'TCC-TESTE',body:'Nome: Anne-Marie D’Ávila\nParecer: Informação acadêmica registrada.'},INITIAL_SETTINGS);
 const pages=await pagesOf(bytes);assert.equal(pages.length,1);
 const text=pages.flatMap(p=>p.items.map((i:any)=>i.str||'')).join(' ');
 assert.match(text,/Anne-Marie D’Ávila/);assert.match(text,/UNIVERSIDADE FEDERAL DO ESPÍRITO SANTO/);
 const {PDFDocument}=await import('pdf-lib');const doc=await PDFDocument.load(bytes);assert.ok(doc.getPage(0).node.Resources()?.toString().includes('/XObject'));
});


test('a entrada persistida do cadastro recompõe o mesmo PDF em uma retomada',async()=>{
 const prepared=prepareRegistrationSnapshot(DEMO_PROCESSES[0],INITIAL_SETTINGS);
 const restored=JSON.parse(JSON.stringify(prepared));
 const original=await renderRegistrationSnapshot(prepared);
 const retried=await renderRegistrationSnapshot(restored);
 assert.ok(original.equals(retried));
});
