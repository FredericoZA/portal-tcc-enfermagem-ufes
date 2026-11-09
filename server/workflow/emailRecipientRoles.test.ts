import test from 'node:test';
import assert from 'node:assert/strict';
import {configuredEmailAudience,getEmailRecipientSelection,validateEmailRecipientSelection} from '../../src/utils/emailRecipientRoles';
import {studioEmailPreview,studioSampleProcess} from '../../src/utils/studioRuntimePreview';
import {executeWorkflowEvent} from './runtime';
const process={...studioSampleProcess(),avaliacao:{status:'PENDENTE'}} as ReturnType<typeof studioSampleProcess>;
const responsible='room@example.invalid',president='president@example.invalid';
test('all eight native templates retain display defaults without modifying legacy data',()=>{
 const expected:Record<string,string[]>={'email-reserva':['RESERVATION_RESPONSIBLE'],'email-reserva-autores':['AUTHORS','ADVISOR'],'email-comprovante-reserva':['RESERVATION_RESPONSIBLE','AUTHORS','ADVISOR'],'email-local-indisponivel':['RESERVATION_RESPONSIBLE','AUTHORS','ADVISOR'],'email-convite':['EXAMINERS'],'email-entrega-repositorio':['AUTHORS','ADVISOR'],'email-assinatura-termo':['AUTHORS','ADVISOR'],'email-conclusao':['AUTHORS','ADVISOR','COADVISOR','EXAMINERS','COMMISSION_PRESIDENT']};
 for(const [id,roles]of Object.entries(expected)){const template={id,recipient:'legacy@example.invalid'};assert.deepEqual(getEmailRecipientSelection(template).recipientRoles,roles);assert.equal(configuredEmailAudience(template,process,responsible,president),undefined);assert.equal(template.recipient,'legacy@example.invalid');}
});
test('explicit To/Cc role groups resolve current participants, exclude duplicate Cc and preserve optional participants',()=>{
 const template={id:'custom',recipientRoles:['AUTHORS','ADVISOR'],ccRoles:['AUTHORS','EXAMINERS','COMMISSION_PRESIDENT']};
 assert.deepEqual(configuredEmailAudience(template,process,responsible,president),{to:[process.aluno1.email,process.aluno2!.email,process.orientador.email],cc:[...process.banca.map(person=>person.email),president]});
 assert.deepEqual(configuredEmailAudience({id:'custom',recipientRoles:['ADVISOR','COADVISOR'],ccRoles:[]},{...process,coorientador:null},responsible,president)?.to,[process.orientador.email]);
});
test('personal reservation request cannot expose action links to unrelated groups or copied recipients',()=>{
 assert.doesNotThrow(()=>validateEmailRecipientSelection({id:'email-reserva',recipientRoles:['RESERVATION_RESPONSIBLE'],ccRoles:[]}));
 for(const template of [{id:'email-reserva',recipientRoles:['AUTHORS']},{id:'email-reserva',recipientRoles:['RESERVATION_RESPONSIBLE'],ccRoles:['COMMISSION_PRESIDENT']},{id:'custom',recipientRoles:[]},{id:'custom',recipientRoles:['MASTER_ADMIN']},{id:'email-convite',recipientRoles:['COMMISSION_PRESIDENT']}])assert.throws(()=>validateEmailRecipientSelection(template));
});
test('custom legacy literals remain visible until roles intentionally replace them',()=>{
 assert.equal(getEmailRecipientSelection({id:'custom',recipient:'legacy@example.invalid',cc:'cc@example.invalid'}).legacyRecipient,'legacy@example.invalid');
 assert.equal(getEmailRecipientSelection({id:'custom',recipient:'legacy@example.invalid',recipientRoles:['ADVISOR']}).legacyRecipient,undefined);
 assert.deepEqual(getEmailRecipientSelection({id:'custom',recipient:'{{ALUNO_1_EMAIL}}, {{ORIENTADOR_EMAIL}}'}).recipientRoles,['AUTHORS','ADVISOR']);
});
test('preview uses only synthetic resolved recipients from the same structured role selection',()=>{
 const preview=studioEmailPreview({emailTemplates:[{id:'email-entrega-repositorio',subject:'Entrega',body:'Olá',recipientRoles:['COMMISSION_PRESIDENT'],ccRoles:['AUTHORS']}]},'email-entrega-repositorio');
 assert.deepEqual(preview.to,['presidencia@example.invalid']);assert.deepEqual(preview.cc,[process.aluno1.email,process.aluno2!.email]);
});
test('custom workflow sends one grouped message for selected roles, without requiring raw recipient syntax',async()=>{
 const template={id:'custom',name:'Custom',subject:'Aviso',body:'Mensagem',recipientRoles:['AUTHORS','ADVISOR'],ccRoles:['EXAMINERS']};
 const studio={revision:1,emailTemplates:[template],workflowStages:[{id:'stage',triggerEvent:'TCC_CREATED',actions:[{id:'notice',type:'email',refId:'custom'}]}],docTemplates:[],formTemplates:[],matrixColumns:[],matrixRows:[]} as any;
 const sent:any[]=[];
 const result=await executeWorkflowEvent(studio,{process,eventCode:'TCC_CREATED',actorEmail:responsible,actorRoles:[]},{createDocument:async()=>({}),createFormTask:async()=>({}),sendEmail:async input=>{sent.push(input);return{externalId:'notice'};}});
 assert.equal(result.status,'COMPLETED');assert.equal(sent.length,1);assert.deepEqual(sent[0].to,[process.aluno1.email,process.aluno2!.email,process.orientador.email]);
});

test('preview tolerates temporarily empty To roles and recovers after selecting a new group',()=>{
 const template={id:'email-entrega-repositorio',subject:'Entrega',body:'Corpo de demonstração',recipientRoles:[],ccRoles:['AUTHORS']} as any;
 const studio={emailTemplates:[template]};
 const empty=studioEmailPreview(studio,template.id);
 assert.deepEqual(empty.to,[]);assert.deepEqual(empty.cc,[]);assert.match(empty.recipientError||'',/Selecione ao menos um papel/);
 assert.ok(empty.text.length>0);assert.ok(empty.html?.length);
 assert.throws(()=>configuredEmailAudience(template,process,responsible,president),'runtime remains strict');
 template.recipientRoles=['COMMISSION_PRESIDENT'];
 const recovered=studioEmailPreview(studio,template.id);
 assert.deepEqual(recovered.to,['presidencia@example.invalid']);assert.deepEqual(recovered.cc,[process.aluno1.email,process.aluno2!.email]);assert.equal(recovered.recipientError,undefined);
});

test('examiner role excludes advisor rows from the board and resolves only actual invited examiners',()=>{
 const board={...process,banca:[{...process.banca[0],email:process.orientador.email,funcao:'ORIENTADOR' as const},...process.banca,process.banca[0]]};
 assert.deepEqual(configuredEmailAudience({id:'email-convite',recipientRoles:['EXAMINERS'],ccRoles:[]},board,responsible,president)?.to,process.banca.map(person=>person.email));
});
