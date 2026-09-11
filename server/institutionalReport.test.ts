import test from 'node:test';
import assert from 'node:assert/strict';
import type { ProcessData, StudioFormSubmission } from '../src/types';
import { buildAdvancedAnalytics } from './advancedAnalytics';
import { buildInstitutionalReport } from './institutionalReport';

const process=(n:number):ProcessData=>({id:`p${n}`,protocolo:`TCC-2026-${n}`,titulo:`Título pessoal secreto ${n}`,etapaAtual:'CONCLUIDO',status:'CONCLUIDO',createdByEmail:`aluno${n}@example.com`,aluno1:{nome:`Nome Pessoal ${n}`,matricula:`20260${n}`,email:`aluno${n}@example.com`},aluno2:null,orientador:{nome:'Orientador',email:'orientador@example.com'},coorientador:null,banca:[{id:'b',nome:'Examinador',email:'examinador@example.com',funcao:'EXAMINER_2'}],defesa:{startAt:'2026-06-01T13:00:00Z',endAt:'2026-06-01T14:30:00Z',local:'Sala',localStatus:'CONFIRMADO',localConfirmedAt:'2026-05-10T12:00:00Z',invitationSentAt:'2026-05-11T12:00:00Z'},avaliacao:{status:'CONCLUIDO',resultadoCode:'APROVADO',resultadoLabel:'Aprovado',submittedAt:'2026-06-01T15:00:00Z'},acervo:{submittedAt:'2026-06-04T12:00:00Z',publishFullWork:true,palavrasChave:['Saúde coletiva']},dataRevision:1,academicCycleId:'2026.1',createdAt:'2026-05-01T12:00:00Z',updatedAt:'2026-06-05T12:00:00Z',completedAt:'2026-06-05T12:00:00Z'});
const form=(n:number):StudioFormSubmission=>({id:`f${n}`,processId:`p${n}`,formId:'dados',formRevision:1,submittedBy:`aluno${n}@example.com`,submittedAt:'2026-06-04T12:00:00Z',answers:{AREA_TEMATICA:'Saúde coletiva',TEMA_PRINCIPAL:'Atenção primária',TIPO_DE_ESTUDO:'Revisão',FINALIDADE_DO_TRABALHO:'Conclusão de curso'},checksum:`hash${n}`,archiveStatus:'ARCHIVED'});

test('relatório institucional produz gráficos vetoriais, metodologia e nenhum dado pessoal',async()=>{
  const processes=[1,2,3].map(process),forms=[1,2,3].map(form);
  const report=buildAdvancedAnalytics({processes,formSubmissions:forms,workflowRuns:[],emailDeliveries:[],signatureJobs:[],correctionRequests:[],courseName:'Enfermagem',institutionName:'UFES',generatedAt:'2026-09-09T12:00:00Z',studio:{operationalConfig:{catalogs:[['AREA_TEMATICA','Saúde coletiva'],['TEMA_PRINCIPAL','Atenção primária'],['TIPO_DE_ESTUDO','Revisão'],['FINALIDADE_DO_TRABALHO','Conclusão de curso']].map(([kind,label],index)=>({id:String(index),kind:kind as any,label,aliases:[],active:true}))} as any}},'2026.1');
  const bytes=await buildInstitutionalReport(report,{courseName:'Enfermagem',institutionName:'UFES'});assert.equal(bytes.subarray(0,5).toString(),'%PDF-');
  const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs'),doc=await getDocument({data:new Uint8Array(bytes),useSystemFonts:true,verbosity:0}).promise;let text='';
  for(let i=1;i<=doc.numPages;i++)text+=(await doc.getPage(i).then(page=>page.getTextContent())).items.map((item:any)=>item.str||'').join(' ');
  assert.ok(doc.numPages>=2);assert.match(text,/Panorama institucional dos TCCs/);assert.match(text,/Metodologia/);assert.match(text,/Áreas temáticas/);assert.doesNotMatch(text,/Nome Pessoal|aluno1@example|Título pessoal secreto/);const destroy=(doc as unknown as {destroy?:()=>Promise<void>}).destroy;if(typeof destroy==='function')await destroy.call(doc);
});
