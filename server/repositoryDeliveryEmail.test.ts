import test from 'node:test';
import assert from 'node:assert/strict';
import {withRepositoryDeliveryEmail,repositoryDeliveryReady,repositoryDeliveryEmailKey,REPOSITORY_DELIVERY_EMAIL_ID,REPOSITORY_DELIVERY_READY} from '../src/utils/repositoryDeliveryEmail';
import {executeWorkflowEvent,planWorkflowEvent} from './workflow/runtime';
import {DEMO_PROCESSES} from '../src/services/demoSeed';
import type {IntegrationStudioSettings} from '../src/types/integrationStudio';
import type {SignatureJob} from '../src/types/signatures';

const processFixture={...structuredClone(DEMO_PROCESSES[0]),etapaAtual:'REPOSITORIO' as const,acervo:undefined};
const job={processId:processFixture.id,documentType:'ATA',status:'ARCHIVED',sourceDataRevision:processFixture.dataRevision} as SignatureJob;
const studio=withRepositoryDeliveryEmail({revision:1,emailTemplates:[],workflowStages:[],docTemplates:[],formTemplates:[]} as unknown as IntegrationStudioSettings);
const context=(ready:boolean)=>({process:processFixture,eventCode:'SIGNATURE_COMPLETED',actorEmail:'webhook@asten.local',actorRoles:[],extraVariables:{[REPOSITORY_DELIVERY_READY]:ready}});

test('entrega final só é liberada pela ata arquivada da revisão atual e antes da entrega',()=>{
 assert.equal(repositoryDeliveryReady(processFixture,[job]),true);
 assert.equal(repositoryDeliveryReady(processFixture,[{...job,status:'SIGNED'}]),false);
 assert.equal(repositoryDeliveryReady(processFixture,[{...job,documentType:'TERMO'}]),false);
 assert.equal(repositoryDeliveryReady(processFixture,[{...job,sourceDataRevision:processFixture.dataRevision+1}]),false);
 assert.equal(repositoryDeliveryReady({...processFixture,acervo:{submittedAt:new Date().toISOString()} as any},[job]),false);
 assert.equal(repositoryDeliveryReady({...processFixture,etapaAtual:'ASSINATURA'},[job]),false);
});
test('rotina fica configurável sem duplicar estágio, ação ou modelo',()=>{
 assert.deepEqual(withRepositoryDeliveryEmail(studio),studio);
 const personalized={...studio,emailTemplates:studio.emailTemplates.map(e=>({...e,subject:'Assunto personalizado'}))};
 assert.equal(withRepositoryDeliveryEmail(personalized).emailTemplates[0].subject,'Assunto personalizado');
 assert.equal(planWorkflowEvent(studio,context(false)).actions.length,0);
 assert.equal(planWorkflowEvent(studio,context(true)).actions.length,1);
});
test('após ata arquivada, envia somente aos autores e orientador com passos, botão e link do acervo',async()=>{
 const before=process.env.PORTAL_PUBLIC_URL;process.env.PORTAL_PUBLIC_URL='https://portal.example/';
 try{
  for(const paired of [false,true]){
   const p={...processFixture,aluno2:paired?{nome:'Segundo autor',email:'segundo@example.org',matricula:'123'}:null};
   const deliveries:any[]=[];
   const run=await executeWorkflowEvent(studio,{...context(true),process:p},{createDocument:async()=>{throw Error('Não deve gerar documento')},createFormTask:async()=>{throw Error('Não deve gerar formulário')},sendEmail:async input=>{deliveries.push(input);return {externalId:'fake-delivery'};}});
   assert.equal(run.status,'COMPLETED',JSON.stringify(run.issues));
   assert.deepEqual(deliveries.flatMap(d=>d.to).sort(),[p.aluno1.email,p.orientador.email,...(p.aluno2?[p.aluno2.email]:[])].map(s=>s.toLowerCase()).sort());
   for(const delivery of deliveries){
    assert.equal(delivery.template.id,REPOSITORY_DELIVERY_EMAIL_ID);
    assert.deepEqual(delivery.template.attachments,[]);
    assert.match(delivery.text,/ajustes ou melhorias eventualmente solicitados/);
    assert.match(delivery.text,/2.000 caracteres/);assert.match(delivery.text,/cinco campos de palavras-chave/);
    assert.match(delivery.text,/Este arquivo é opcional/);assert.match(delivery.text,/somente o resumo expandido/);
    assert.match(delivery.text,/secao=acervo/);assert.match(delivery.text,new RegExp('E-mail de acesso: '+delivery.to[0].replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
    assert.match(delivery.html,/<a href="https:\/\/portal.example\/\?tcc=[^" ]+&amp;secao=acervo"/);
    assert.match(delivery.html,/Acessar entrega no Repositório/);
   }
   const resumed:any[]=[];
   await executeWorkflowEvent(studio,{...context(true),process:p,completedActions:run.actions},{createDocument:async()=>({}),createFormTask:async()=>({}),sendEmail:async input=>{resumed.push(input);return {};}});
   assert.equal(resumed.length,0);
  }
 }finally{if(before===undefined)delete process.env.PORTAL_PUBLIC_URL;else process.env.PORTAL_PUBLIC_URL=before;}
});

test('chave de entrega é estável por processo, revisão e destinatário, sem depender do autor da nova tentativa',()=>{
 assert.equal(repositoryDeliveryEmailKey(processFixture,' ALUNO@EXAMPLE.ORG '),repositoryDeliveryEmailKey(processFixture,'aluno@example.org'));
 assert.notEqual(repositoryDeliveryEmailKey(processFixture,'aluno@example.org'),repositoryDeliveryEmailKey({...processFixture,dataRevision:processFixture.dataRevision+1},'aluno@example.org'));
});
