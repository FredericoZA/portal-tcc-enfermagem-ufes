import {processEmailMessage} from '../src/utils/processEmailMessage';
import test from 'node:test';
import assert from 'node:assert/strict';
import {withConsolidatedEmailNotifications,finalProcessEmailKey,isConsolidatedEmailNotice} from '../src/utils/consolidatedEmailNotifications';
import {executeWorkflowEvent} from './workflow/runtime';
import {dispatchTrackedEmail} from './integrations/trackedGmail';
import {operationalEmailRecipients} from './workflow/operationalEmailRecipients';
import {DEMO_PROCESSES} from '../src/services/demoSeed';
const p={...structuredClone(DEMO_PROCESSES[0]),status:'CONCLUIDO',etapaAtual:'CONCLUIDO'} as typeof DEMO_PROCESSES[number];
const source={revision:1,emailTemplates:[{id:'old-signature',recipient:p.aluno1.email,subject:'Assinatura',body:'Aviso'},{id:'email-entrega-repositorio',recipient:p.aluno1.email,subject:'Entrega',body:'Entregue'}],docTemplates:[],formTemplates:[],matrixColumns:[],matrixRows:[],workflowStages:[{id:'signed',triggerEvent:'SIGNATURE_COMPLETED',actions:[{id:'old',type:'email',refId:'old-signature'},{id:'repo',type:'email',refId:'email-entrega-repositorio'}]},{id:'complete-a',triggerEvent:'PROCESS_COMPLETED',actions:[{id:'final-old',type:'email',refId:'old-signature'},{id:'keep',type:'form',refId:'form-a'}]},{id:'complete-b',triggerEvent:'PROCESS_COMPLETED',actions:[{id:'duplicate',type:'email',refId:'old-signature'}]}]} as any;
test('consolidação remove avisos genéricos e duplicados, preservando entrega e ações não relacionadas',()=>{
 const next=withConsolidatedEmailNotifications(source);assert.deepEqual(withConsolidatedEmailNotifications(next),next);assert.equal(source.workflowStages[0].actions.length,2);
 assert.deepEqual((next.workflowStages[0].actions as any[]).map(a=>a.refId),['email-entrega-repositorio']);
 const final=next.workflowStages.filter(s=>s.triggerEvent==='PROCESS_COMPLETED').flatMap(s=>s.actions as any[]);assert.equal(final.filter(a=>a.type==='email').length,1);assert.ok(final.some(a=>a.id==='keep'));
 assert.equal(isConsolidatedEmailNotice('SIGNATURE_COMPLETED','old-signature'),true);assert.equal(isConsolidatedEmailNotice('TCC_CREATED','email-instrucoes-cadastro'),true);assert.equal(isConsolidatedEmailNotice('LOCATION_CONFIRMED','email-confirmacao'),true);assert.equal(isConsolidatedEmailNotice('SIGNATURE_COMPLETED','email-entrega-repositorio'),false);
});
test('encerramento tem um envio para todos os participantes por revisão, independentemente de novas execuções',async()=>{
 const studio=withConsolidatedEmailNotifications({...source,workflowStages:source.workflowStages.map((s:any)=>({...s,actions:s.actions.filter((a:any)=>a.type==='email')}))});
 const records=new Map<string,any>(),delivered:string[][]=[];const president='president@example.invalid';
 const ports={createDocument:async()=>({}),createFormTask:async()=>({}),resolveEmailRecipients:({template,recipients}:any)=>operationalEmailRecipients(template.id,p,'department@example.invalid',recipients,president),sendEmail:async(input:any)=>{
  const recipient=input.to[0],key=finalProcessEmailKey(p);
  const mail=await dispatchTrackedEmail({processId:p.id,recipient,additionalRecipients:input.to.slice(1),subject:input.subject,text:input.text,idempotencyKey:key},{journal:{findByIdempotencyKey:async k=>records.get(k)||null,save:async r=>{records.set(r.idempotencyKey,r);}},send:async()=>{delivered.push(input.to);return{id:'gmail-local-fixture'};}});return{externalId:mail.id};}};
 const context={process:p,eventCode:'PROCESS_COMPLETED',actorEmail:p.orientador.email,actorRoles:[]};
 assert.equal((await executeWorkflowEvent(studio,context,ports)).status,'COMPLETED');
 const expected=operationalEmailRecipients('email-conclusao',p,'',[],president);assert.deepEqual(delivered,[expected]);assert.ok(!delivered.flat().includes('department@example.invalid'));
 await executeWorkflowEvent(studio,{...context,actorEmail:president},ports);assert.equal(delivered.length,1);
 assert.notEqual(finalProcessEmailKey(p),finalProcessEmailKey({...p,dataRevision:p.dataRevision+1}));
});


test('cadastro e confirmação não geram avisos duplicados; solicitação, convite e comprovante preservam a informação',()=>{
 const next=withConsolidatedEmailNotifications({...source,workflowStages:[{id:'created',triggerEvent:'TCC_CREATED',actions:[{id:'request',type:'email',refId:'email-reserva'},{id:'ack',type:'email',refId:'email-instrucoes-cadastro'}]},{id:'confirmed',triggerEvent:'LOCATION_CONFIRMED',actions:[{id:'duplicate',type:'email',refId:'email-confirmacao'},{id:'invite',type:'email',refId:'email-convite'}]}]});
 assert.deepEqual((next.workflowStages[0].actions as any[]).map(a=>a.refId),['email-reserva']);assert.deepEqual((next.workflowStages[1].actions as any[]).map(a=>a.refId),['email-convite']);
 const common={process:{...p,defesa:{...p.defesa,departmentResponse:{decision:'CONFIRMED',revision:1,respondedAt:'2026-10-26',respondedBy:'department@example.invalid',startAt:p.defesa.startAt,endAt:p.defesa.endAt}}},recipient:p.aluno1.email,subject:'Reserva confirmada',text:'O departamento confirmou a reserva.',templateId:'email-comprovante-reserva',baseUrl:'https://portal.example',courseName:'Enfermagem'} as const;
 const confirmation=processEmailMessage(common);assert.match(confirmation.text,/no dia da defesa.*Conceito e Ata/);assert.equal((confirmation.html.match(/<a /g)||[]).length,1);
 const department=processEmailMessage({...common,recipient:'department@example.invalid',departmentUrl:'https://portal.example/department-receipt'});assert.match(department.text,/Conceito e Ata/);
 const request=processEmailMessage({...common,templateId:'email-reserva',departmentUrl:undefined});assert.match(request.text,/cadastro do trabalho foi recebido/);assert.match(request.text,/confirmação do departamento/);
});
test('retira apenas aviso de declaração à presidência, preservando criação e assinatura do documento',()=>{
 const declaration={id:'president',triggerEvent:'PUBLICATION_CLEARED',actions:[{id:'notify',type:'email',refId:'email-assinatura-declaracao'},{id:'document',type:'doc',refId:'DECLARACAO'}]};
 const result=withConsolidatedEmailNotifications({...source,workflowStages:[declaration]});assert.deepEqual(result.workflowStages[0].actions,[declaration.actions[1]]);assert.equal(isConsolidatedEmailNotice('PUBLICATION_CLEARED','email-assinatura-declaracao'),true);assert.equal(isConsolidatedEmailNotice('PUBLICATION_CLEARED','custom-email'),false);
});
test('aviso de ata disponível é retirado sem remover preparação da assinatura ou aviso de entrega após arquivamento',()=>{
 const stages=[{id:'evaluation',triggerEvent:'EVALUATION_SUBMITTED',actions:[{id:'notify',type:'email',refId:'email-assinatura-ata'},{id:'ata',type:'doc',refId:'tmpl-ata'}]},{id:'signed',triggerEvent:'SIGNATURE_COMPLETED',actions:[{id:'delivery',type:'email',refId:'email-entrega-repositorio'}]}];
 const result=withConsolidatedEmailNotifications({...source,workflowStages:stages});assert.deepEqual(result.workflowStages[0].actions,[stages[0].actions[1]]);assert.deepEqual(result.workflowStages[1].actions,stages[1].actions);assert.equal(isConsolidatedEmailNotice('EVALUATION_SUBMITTED','email-assinatura-ata'),true);assert.equal(isConsolidatedEmailNotice('SIGNATURE_COMPLETED','email-entrega-repositorio'),false);
});

test('aviso do termo só permanece quando pelo menos uma publicação foi autorizada',async()=>{
 const {withApplicableProcessEmails,processEmailApplicable}=await import('../src/utils/consolidatedEmailNotifications');
 const termStudio={...source,emailTemplates:[{id:'email-assinatura-termo',recipient:p.aluno1.email,subject:'Termo',body:'Termo disponível'}],workflowStages:[{id:'repository',triggerEvent:'REPOSITORY_SUBMITTED',actions:[{id:'notify-term',type:'email',refId:'email-assinatura-termo'}]}]};
 for(const [full,abstract] of [[false,false],[true,false],[false,true],[true,true]]){
  const process={...p,acervo:{...p.acervo,publishFullWork:full,publishExpandedAbstract:abstract}} as typeof p;
  const applicable=withApplicableProcessEmails(termStudio,process),sent:string[]=[];
  const result=await executeWorkflowEvent(applicable,{process,eventCode:'REPOSITORY_SUBMITTED',actorEmail:p.orientador.email,actorRoles:[]},{createDocument:async()=>({}),createFormTask:async()=>({}),sendEmail:async input=>{sent.push(input.template.id as string);return{};}});
  assert.equal(result.status,'COMPLETED');assert.equal(sent.length,full||abstract?1:0);assert.equal(processEmailApplicable(process,'email-assinatura-termo'),full||abstract);assert.equal(processEmailApplicable(process,'email-conclusao'),true);
 }
});
