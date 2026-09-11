import assert from 'node:assert/strict';
import test from 'node:test';
import type { ProcessData, SignatureJob } from '../src/types';
import type { IntegrationStudioSettings } from '../src/types/integrationStudio';
import { DEFAULT_OPERATIONAL_CONFIG, registrationQuestions, localDateTimeToIso, presentVariables, resolveCatalogValue } from '../src/utils/operationalConfig';
import { acceptRegistration } from './workflow/registration';
import { ataArchived, declarationReady } from './workflow/gates';
import { simulateWorkflow } from './workflow/simulator';
import { buildMarkerBoldRequests } from './integrations/googleDocsStyles';
import { buildProcessVariables } from './workflow/runtime';
import { buildAdvancedAnalytics, analyticsCsv } from './advancedAnalytics';
import { upgradeStudioDraft } from '../src/utils/studioUpgrade';
import { buildContinuousIntelligenceState } from './continuousIntelligence';

const p: ProcessData={id:'test',protocolo:'TCC-2026-0001',titulo:'Título',createdByEmail:'aluno@example.invalid',aluno1:{nome:'Ana Souza',email:'ana@example.invalid',matricula:'1'},aluno2:null,orientador:{nome:'Bruno Santos',email:'bruno@example.invalid',siape:'1'},coorientador:null,banca:[],defesa:{startAt:'2026-01-02T12:00:00Z',endAt:'2026-01-02T13:00:00Z',local:'Sala'},avaliacao:{status:'CONCLUIDO',submittedAt:'2026-01-02T13:00:00Z'},status:'AGUARDANDO_DADOS_FINAIS',etapaAtual:'REPOSITORIO',createdAt:'2026-01-01T12:00:00Z',updatedAt:'2026-01-02T13:00:00Z',dataRevision:3,acervo:{submittedAt:'2026-01-03T12:00:00Z',publishFullWork:true}};
const job=(type:string,status='ARCHIVED')=>({id:type,processId:p.id,documentType:type,status,documentVersion:1,sourceDataRevision:3,driveSignedFileId:'signed',createdAt:'2026-01-01T00:00:00Z',completedAt:'2026-01-02T00:00:00Z'} as SignatureJob);
function studio():IntegrationStudioSettings {
  const document=(type:string)=>({id:`tmpl-${type.toLowerCase()}`,type,label:type,driveFileId:'fixture123456789',variables:[],templateContentText:''});
  const stage=(id:string,event:string,actions:any[])=>({id,triggerEvent:event,title:id,actions});
  const doc=(type:string)=>({id:`doc-${type}`,type:'doc',refId:`tmpl-${type.toLowerCase()}`,title:type,...(type==='TERMO'?{condition:{fieldKey:'PUBLICAR_TRABALHO',operator:'IS_TRUE'}}:{})});
  return {schemaVersion:3,revision:1,savedAt:'2026-09-08',savedBy:'master@example.invalid',driveModelosFolderUrl:'',brandKit:{institutionName:'Universidade',courseName:'Enfermagem',primaryColor:'#005830',textColor:'#ffffff'} as any,documentDesigns:{},emailDesigns:{},formDesigns:{},matrixColumns:[],matrixRows:[],docTemplates:['CONVITE','ATA','TERMO','DECLARACAO'].map(document),formTemplates:[],emailTemplates:[{id:'reserva',name:'Reserva',recipient:'{{DEPARTAMENTO_EMAIL}}',subject:'Reserva {{PROTOCOLO}}',body:'{{DEFESA_LOCAL}}'},{id:'convite',name:'Convite',recipient:'{{BANCA_EMAILS}}',subject:'Convite',body:'{{TITULO}}',attachments:['tmpl-convite']}],workflowStages:[stage('cadastro','TCC_CREATED',[{id:'email-reserva',type:'email',refId:'reserva'}]),stage('convite','LOCATION_CONFIRMED',[doc('CONVITE'),{id:'email-convite',type:'email',refId:'convite'}]),stage('avaliacao','EVALUATION_SUBMITTED',[doc('ATA')]),stage('final','REPOSITORY_SUBMITTED',[doc('TERMO')]),stage('presidente','PUBLICATION_CLEARED',[doc('DECLARACAO')])],auditTrail:[],operationalConfig:{...DEFAULT_OPERATIONAL_CONFIG,reservation:{departmentEmail:'departamento@example.invalid',locations:['Sala','Auditório']}}};
}

test('horário do formulário respeita o fuso institucional e rejeita data inexistente',()=>{
  assert.equal(localDateTimeToIso('2026-09-08T14:30','America/Sao_Paulo'),'2026-09-08T17:30:00.000Z');
  assert.throws(()=>localDateTimeToIso('2026-02-30T14:30','America/Sao_Paulo'));
});
test('cadastro publicado mantém SIAPE, opções do Master e bloqueia campo obrigatório ausente',()=>{
  const s=studio();s.formTemplates=[{id:'form-reserva-aluno',questions:[{id:'extra',fieldKey:'PERGUNTA_NOVA',label:'Pergunta da secretaria',required:true,fieldType:'text'}]}];
  const fields=registrationQuestions(s);assert.ok(fields.some(f=>f.fieldKey==='ORIENTADOR_SIAPE'&&f.required));assert.ok(fields.some(f=>f.fieldKey==='COORIENTADOR_SIAPE'&&!f.required));assert.deepEqual(fields.find(f=>f.fieldKey==='DEFESA_LOCAL')?.options,['Sala','Auditório']);
  assert.throws(()=>acceptRegistration({registrationAnswers:{}},s),/Pergunta da secretaria/);
});
test('a mesma data tem apresentação numérica e por extenso sem mudar sua origem',()=>{
  const s=studio();s.operationalConfig!.presentations={'tmpl-convite':[{marker:'DATA',source:'DEFESA_DATA_HORA',format:'date',letterCase:'original',bold:false},{marker:'HORA',source:'DEFESA_DATA_HORA',format:'time',letterCase:'original',bold:false}]};
  const result=presentVariables({DEFESA_DATA_HORA:'2026-09-08T17:30:00Z'},'tmpl-convite',s);assert.equal(result.DATA,'08/09/2026');assert.equal(result.HORA,'14:30');assert.equal(result.DEFESA_DATA_HORA,'2026-09-08T17:30:00Z');
});
test('negrito localiza marcador dividido entre runs sem formatar o restante do texto',()=>{
  const requests=buildMarkerBoldRequests({tabs:[{tabProperties:{tabId:'t.0'},documentTab:{body:{content:[{paragraph:{elements:[{startIndex:1,textRun:{content:'Olá <<NO'}},{startIndex:9,textRun:{content:'ME>> fim'}}]}}]}}}]},['NOME']);
  assert.deepEqual(requests[0].updateTextStyle.range,{tabId:'t.0',startIndex:5,endIndex:13});assert.equal(requests.length,1);
});
test('resposta livre não altera autorização de publicação ou destinatários canônicos',()=>{
  const protectedProcess={...p,coorientador:{nome:'Caio Lima',email:'caio@example.invalid',siape:'7654321',instituicao:'UFES'},banca:[{id:'e2',nome:'Dora Alves',email:'dora@example.invalid',siape:'1111111',instituicao:'UFES',funcao:'EXAMINER_2' as const},{id:'e3',nome:'Eva Reis',email:'eva@example.invalid',siape:'2222222',instituicao:'IFES',funcao:'EXAMINER_3' as const}]};
  const vars=buildProcessVariables({process:protectedProcess,eventCode:'TCC_CREATED',actorEmail:'a@example.invalid',actorRoles:[],extraVariables:{ORIENTADOR_EMAIL:'intruso@example.invalid',COORIENTADOR_SIAPE:'0000000',EXAMINADOR_2_NOME:'Nome adulterado',PUBLICAR_TRABALHO:false,TITULO:'adulterado'}});
  assert.equal(vars.ORIENTADOR_EMAIL,p.orientador.email);assert.equal(vars.COORIENTADOR_SIAPE,'7654321');assert.equal(vars.EXAMINADOR_2_NOME,'Dora Alves');assert.equal(vars.EXAMINADOR_3_INSTITUICAO,'IFES');assert.equal(vars.PUBLICAR_TRABALHO,'true');assert.equal(vars.TITULO,p.titulo);
});
test('a declaração espera o Termo vigente e a Ata arquivados',()=>{
  assert.equal(ataArchived(p,[]),false);assert.equal(declarationReady(p,[job('ATA')]),false);assert.equal(declarationReady(p,[job('ATA'),job('TERMO','SIGNED')]),false);assert.equal(declarationReady(p,[job('ATA'),{...job('TERMO'),sourceDataRevision:2}]),false);assert.equal(declarationReady(p,[job('ATA'),job('TERMO')]),true);
  assert.equal(declarationReady({...p,acervo:{...p.acervo,publishFullWork:false}},[job('ATA')]),true);
});
test('simulação percorre papéis sem efeitos externos e espera confirmação de local',async()=>{
  const hold=await simulateWorkflow(studio(),{locationConfirmed:false});assert.equal(hold.emails.length,1);assert.match(hold.events.at(-1)!.state,/BLOQUEADO/);
  const full=await simulateWorkflow(studio(),{secondAuthor:true});assert.equal(full.externalEffects,false);assert.ok(full.events.some(e=>e.event==='PUBLICATION_CLEARED'));assert.ok(full.events.some(e=>e.event==='PROCESS_COMPLETED'));
  const failure=await simulateWorkflow(studio(),{failActionId:'doc-CONVITE'});assert.equal(failure.emails.length,1);assert.equal(failure.events.at(-1)!.state,'PARTIAL_FAILURE');
});
test('catálogo resolve sinônimos e respeita datas de vigência',()=>{
  const entries=[{id:'a',kind:'AREA_TEMATICA' as const,label:'Saúde coletiva',aliases:['SC'],active:true,validFrom:'2026-01-01',validUntil:'2026-12-31'}];
  assert.equal(resolveCatalogValue(entries,'AREA_TEMATICA','sc','2026-09-08'),'Saúde coletiva');assert.equal(resolveCatalogValue(entries,'AREA_TEMATICA','SC','2027-01-01'),'');
});
const input=(processes:ProcessData[])=>({processes,workflowRuns:[],emailDeliveries:[],signatureJobs:[],formSubmissions:[],correctionRequests:[],courseName:'Enfermagem',institutionName:'Universidade',generatedAt:'2026-09-08T12:00:00Z'});
test('comparação não divulga taxas de grupos pequenos e CSV neutraliza fórmulas',()=>{
  const report=buildAdvancedAnalytics(input([{...p,academicCycleId:'2026.1'}]),'2026.1','2026.1');assert.equal(report.comparison!.count,null);assert.equal(report.stages[0].medianDays,null);
  report.trends=[{period:'=HYPERLINK(1)',count:3,completionRate:0,suppressed:false}];assert.match(analyticsCsv(report),/"'=HYPERLINK/);
});
test('diagnóstico não mantém falha de fluxo já recuperada e usa prazo publicado',()=>{
  const base=input([p]);const failure={id:'first',processId:p.id,eventCode:'TCC_CREATED',status:'PARTIAL_FAILURE',startedAt:'2026-09-01',actions:[]} as any;
  const state=buildContinuousIntelligenceState({...base,studio:{operationalConfig:{...DEFAULT_OPERATIONAL_CONFIG,diagnostics:{staleDays:365,minimumCoverage:40,priority:'P3'}}},workflowRuns:[failure,{...failure,id:'second',status:'COMPLETED',startedAt:'2026-09-02'}]});
  assert.ok(!state.proposals.some(r=>r.id==='improvement-workflow-failures'&&r.evidenceActive));assert.ok(!state.proposals.some(r=>r.id==='improvement-stale-processes'&&r.evidenceActive));assert.equal(state.proposals.find(r=>r.id==='improvement-analytics-coverage')?.priority,'P3');
});


test('rascunho antigo migra a declaração preservando os modelos e sem duplicar ações', () => {
  const old = studio();
  const declaration = old.workflowStages.pop()!;
  (old.workflowStages.at(-1)!.actions as any[]).push(...declaration.actions as any[]);
  const upgraded = upgradeStudioDraft(old);
  const twice = upgradeStudioDraft(upgraded);
  assert.deepEqual(twice, upgraded);
  assert.equal(upgraded.workflowStages!.filter(s => s.triggerEvent === 'PUBLICATION_CLEARED').length, 1);
  assert.deepEqual(upgraded.docTemplates, old.docTemplates);
  assert.ok(old.workflowStages.every(s => s.triggerEvent !== 'PUBLICATION_CLEARED'));
});
