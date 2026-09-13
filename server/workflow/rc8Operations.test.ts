import test from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import type { ProcessData, SignatureJob } from '../../src/types';
import { DraftConflict, pruneDrafts, saveRegistrationDraft } from './drafts';
import { addBusinessDays, claimableReminder, plannedDeadlines, waitingMilestone } from './deadlines';
import { inspectPdfLayout, markPreview } from './documentQuality';
import { registrationFindings, DEFAULT_WORKFLOW_OPERATIONS } from '../../src/utils/workflowOperations';
import { buildRecoveryQueue } from './recovery';
import { renderReminder } from './reminders';
import { executeWorkflowEvent } from './runtime';
import type { IntegrationStudioSettings } from '../../src/types/integrationStudio';

const process=(patch:Partial<ProcessData>={}):ProcessData=>({id:'p1',protocolo:'TCC-2026-0001',titulo:'Cuidado seguro',etapaAtual:'CADASTRO',status:'AGUARDANDO_CONFIRMACAO_LOCAL',createdByEmail:'ana@aluno.ufes.br',aluno1:{nome:'Ana Silva',matricula:'20260001',email:'ana@aluno.ufes.br'},aluno2:null,orientador:{nome:'Bruno Souza',email:'bruno@ufes.br'},coorientador:null,banca:[{id:'b1',nome:'Carla Lima',email:'carla@ufes.br',funcao:'EXAMINER_2'}],defesa:{startAt:'2026-09-15T17:00:00Z',endAt:'2026-09-15T18:30:00Z',local:'Auditório',localStatus:'PENDENTE'},avaliacao:{status:'PENDENTE'},dataRevision:1,createdAt:'2026-09-01T12:00:00Z',updatedAt:'2026-09-01T12:00:00Z',...patch});
const policy={...DEFAULT_WORKFLOW_OPERATIONS,deadlines:[{id:'local-3',milestone:'LOCATION' as const,businessDays:2,reminderEveryDays:2,maxReminders:3,emailTemplateId:'lembrete',active:true}]};

test('rascunho pertence ao autor, força o e-mail autenticado e detecta concorrência',()=>{
  const studio={revision:8,operationalConfig:{workflow:{...policy,draftExpiryDays:12}}} as Partial<IntegrationStudioSettings>;
  const first=saveRegistrationDraft(undefined,{expectedRevision:0,schemaRevision:8,section:1.9,answers:{ALUNO_1_NOME:'Ana Silva',ALUNO_1_EMAIL:'outra@example.com'}},'ana@aluno.ufes.br',studio,new Date('2026-09-01T00:00:00Z'));
  assert.equal(first.answers.ALUNO_1_EMAIL,'ana@aluno.ufes.br');assert.equal(first.section,1);assert.equal(first.expiresAt,'2026-09-13T00:00:00.000Z');
  assert.throws(()=>saveRegistrationDraft(first,{expectedRevision:0,schemaRevision:8,answers:{}},'ana@aluno.ufes.br',studio,new Date('2026-09-02T00:00:00Z')),DraftConflict);
  assert.deepEqual(pruneDrafts({'ana@aluno.ufes.br':first},new Date('2026-09-14T00:00:00Z')),{});
});

test('alertas de identidade são consultivos e não alteram as respostas',()=>{
  const answers={ALUNO_1_NOME:'Ana  1',ALUNO_1_MATRICULA:'12',ORIENTADOR_SIAPE:'ABC'};const before=structuredClone(answers);
  assert.ok(registrationFindings(answers,DEFAULT_WORKFLOW_OPERATIONS).length>=3);assert.deepEqual(answers,before);
});

test('dias úteis excluem fim de semana e feriados e limitam lembretes',()=>{
  const configured={...policy,holidays:['2026-09-07']};assert.equal(addBusinessDays('2026-09-04',1,configured),'2026-09-08');
  const plans=plannedDeadlines([process()],[],configured,'UTC',new Date('2026-09-10T12:00:00Z'));assert.equal(plans[0].dueDate,'2026-09-03');assert.equal(plans[0].overdue,true);
  const claim=claimableReminder(plans[0],'ana@aluno.ufes.br',[],configured,new Date('2026-09-10T12:00:00Z'));assert.equal(claim?.ordinal,1);
  assert.equal(claimableReminder(plans[0],'ana@aluno.ufes.br',[{...claim!,status:'FAILED'}],configured,new Date('2026-09-10T12:00:00Z')),null);
});

test('ordem de espera exige Ata arquivada no Drive antes da entrega final',()=>{
  const p=process({defesa:{...process().defesa,localStatus:'CONFIRMADO'},avaliacao:{status:'CONCLUIDO',submittedAt:'2026-09-15T19:00:00Z'}});
  const job={id:'a',processId:p.id,protocol:p.protocolo,documentType:'ATA',documentTitle:'Ata',documentVersion:1,sourceDataRevision:1,status:'ARCHIVED',signers:[],createdAt:'2026-09-15T19:00:00Z',updatedAt:'2026-09-15T20:00:00Z'} as SignatureJob;
  assert.equal(waitingMilestone(p,[job])?.milestone,'ATA');job.driveSignedFileId='drive';assert.equal(waitingMilestone(p,[job])?.milestone,'FINAL_DELIVERY');
});

test('análise do PDF aponta marcador, página vazia e marca a amostra',async()=>{
  const doc=await PDFDocument.create(),font=await doc.embedFont(StandardFonts.Helvetica);doc.addPage([595,842]).drawText('Convite para <<ALUNO_NOME>>',{x:40,y:800,font,size:12});doc.addPage([595,842]);
  const bytes=Buffer.from(await doc.save()),report=await inspectPdfLayout(bytes,{maximumPages:1,needsSignature:true});
  assert.ok(report.issues.some(issue=>issue.code==='UNRESOLVED_MARKER'));assert.ok(report.issues.some(issue=>issue.code==='PAGE_LIMIT'));assert.ok(report.issues.some(issue=>issue.code==='EMPTY_PAGE'));
  const marked=await markPreview(bytes),opened=await PDFDocument.load(marked);assert.equal(opened.getTitle(),'Amostra do modelo - sem validade');
});

test('central de recuperação mostra somente a versão documental mais recente',()=>{
  const jobs=[1,2].map(version=>({id:`j${version}`,processId:'p1',protocol:'TCC-1',documentType:'ATA',documentTitle:'Ata',documentVersion:version,sourceDataRevision:version,status:'PROVIDER_ERROR',signers:[],createdAt:'2026-09-01T00:00:00Z',updatedAt:'2026-09-01T00:00:00Z'})) as SignatureJob[];
  const queue=buildRecoveryQueue({processes:[process()],runs:[],jobs,emails:[],forms:[],customForms:[]});assert.deepEqual(queue.map(item=>item.id),['j2']);
});

test('lembrete usa destinatário canônico e escapa HTML dinâmico',()=>{
  const studio={revision:8,operationsPolicy:{timezone:'UTC'},operationalConfig:{reservation:{departmentEmail:'departamento@ufes.br',locations:[]},catalogs:[],presentations:{},diagnostics:{staleDays:30,minimumCoverage:80,priority:'P2'},workflow:policy},emailTemplates:[{id:'lembrete',recipient:'{{ALUNO_1_EMAIL}}',subject:'Prazo {{DATA_LIMITE}}',body:'Olá {{ALUNO_1_NOME}}',htmlBody:'<b>{{ALUNO_1_NOME}}</b>'}],docTemplates:[],formTemplates:[],workflowStages:[],matrixColumns:[],matrixRows:[],brandKit:{},documentDesigns:{},emailDesigns:{},formDesigns:{},auditTrail:[]} as unknown as IntegrationStudioSettings;
  const rendered=renderReminder(studio,process({aluno1:{nome:'<script>alert(1)</script>',matricula:'1',email:'ana@aluno.ufes.br'}}),'lembrete','Confirmação do local','2026-09-10');assert.deepEqual(rendered.to,['ana@aluno.ufes.br']);assert.match(rendered.html!,/&lt;script&gt;/);
});

test('retomada preserva ação já concluída e executa somente a pendente',async()=>{
  const studio={revision:8,docTemplates:[{id:'d'}],emailTemplates:[{id:'e',recipient:'{{ALUNO_1_EMAIL}}',subject:'Teste',body:'Teste'}],formTemplates:[],workflowStages:[{id:'s',stageNumber:1,title:'Etapa',triggerEvent:'TCC_CREATED',actions:[{id:'doc',type:'doc',refId:'d',title:'Doc'},{id:'email',type:'email',refId:'e',title:'Email'}]}],matrixColumns:[],matrixRows:[],brandKit:{},documentDesigns:{},emailDesigns:{},formDesigns:{},auditTrail:[]} as unknown as IntegrationStudioSettings;
  let docs=0,mails=0;const run=await executeWorkflowEvent(studio,{process:process(),actorEmail:'master@ufes.br',actorRoles:[],eventCode:'TCC_CREATED',completedActions:[{actionId:'doc',stageId:'s',kind:'DOCUMENT',status:'COMPLETED',externalId:'drive-1'}]}, {createDocument:async()=>{docs++;return{};},createFormTask:async()=>({}),sendEmail:async()=>{mails++;return{};}});
  assert.equal(run.status,'COMPLETED');assert.equal(docs,0);assert.equal(mails,1);
});