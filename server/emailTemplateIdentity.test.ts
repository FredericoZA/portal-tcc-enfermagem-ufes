import test from 'node:test';
import assert from 'node:assert/strict';
import {uniqueEmailTemplates} from '../src/utils/emailTemplateIdentity';
import {upgradeStudioDraft} from '../src/utils/studioUpgrade';

test('reserva com destinatário literal ou vazio não gera modelos repetidos ao reabrir o Estúdio',()=>{
 for(const recipient of ['departamento@example.invalid','']){
  const reservation={id:'email-reserva',name:'Reserva editada',recipient,subject:'Assunto definido pelo usuário',body:'Conteúdo editado',htmlBody:'<b>Conteúdo editado</b>',attachments:['doc-convite']};
  let draft:any={emailTemplates:[reservation],workflowStages:[{id:'registration',triggerEvent:'TCC_CREATED',actions:[{id:'request',type:'email',refId:'email-reserva'}]}]};
  for(let i=0;i<5;i++)draft=upgradeStudioDraft(draft);
  assert.equal(draft.emailTemplates.length,2);assert.equal(draft.emailTemplates[0].recipient,recipient);assert.equal(draft.emailTemplates[0].subject,reservation.subject);assert.ok(draft.emailTemplates[0].htmlBody.startsWith(reservation.htmlBody));assert.deepEqual(draft.emailTemplates[0].attachments,[]);
  assert.deepEqual(upgradeStudioDraft(draft).emailTemplates,draft.emailTemplates);
  assert.equal(draft.workflowStages[0].actions.filter((action:any)=>action.refId==='email-reserva').length,1);
 }
});
test('consolida IDs repetidos e preserva modelos distintos mesmo com o mesmo nome',()=>{
 const original={id:'email-reserva',name:'Solicitação de reserva ao departamento',recipient:'dept@example.invalid',body:'Texto editado'};
 const templates=[original,{...original,recipient:'{{DEPARTAMENTO_EMAIL}}'}, {...original,id:'custom-reservation'}];
 assert.deepEqual(uniqueEmailTemplates(templates),[original,templates[2]]);assert.equal(templates.length,3);
 const draft=upgradeStudioDraft({emailTemplates:templates,workflowStages:[{id:'r',triggerEvent:'TCC_CREATED',actions:[]}]});
 assert.deepEqual(draft.emailTemplates?.map(item=>item.id),['email-reserva','custom-reservation','email-entrega-repositorio']);
});
