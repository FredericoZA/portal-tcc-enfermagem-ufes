import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {WorkflowRecipientCell} from '../src/components/WorkflowRecipientCell';
import {RoleSelectionControl} from '../src/components/RoleSelectionControl';
import {OPERATIONAL_EMAIL_CATALOG} from '../src/utils/studioOperationalCatalog';
const render=(kind:string,template:any,invitationEmail?:any)=>renderToStaticMarkup(React.createElement(WorkflowRecipientCell,{kind,template,invitationEmail,onOpen:()=>{}}));
test('workflow displays every native email audience even before an action is selected, without editable raw recipients',()=>{
 for(const [id,,recipient]of OPERATIONAL_EMAIL_CATALOG){const html=render('email',{id,recipient});assert.doesNotMatch(html,/<input|Selecione o item|Nenhum destinatário|truncate|whitespace-nowrap/);assert.match(html,/Configurar destinatários/);}
});
test('workflow reflects model audiences for forms, signature documents and the invitation source',()=>{
 assert.match(render('form',{id:'custom',targetRole:'Aluno'}),/Autores/);
 assert.match(render('form',{id:'custom',targetRole:'Aluno',recipientRoles:['ADVISOR','EXAMINERS']}),/Orientador, Examinadores/);
 const base={id:'tmpl-termo',type:'TERMO'};assert.doesNotMatch(render('doc',base),/Presidência/);
 assert.match(render('doc',{...base,signatureRecipientRoles:['AUTHORS','ADVISOR','COMMISSION_PRESIDENT']}),/Presidência/);
 const convite=render('doc',{id:'tmpl-convite',type:'CONVITE'},{id:'email-convite',recipientRoles:['EXAMINERS','COMMISSION_PRESIDENT'],ccRoles:['AUTHORS']});
 assert.match(convite,/Examinadores, Presidência da comissão/);assert.match(convite,/Cópia: Autores/);assert.match(convite,/Envio pelo e-mail de convite/);
 assert.match(render('doc',{id:'custom-file'}),/sem envio próprio/);
 assert.match(render('form',undefined),/Item não encontrado/);
});
test('required roles remain fixed while optional roles use a bounded selection instead of typing',()=>{
 const html=renderToStaticMarkup(React.createElement(RoleSelectionControl,{label:'Assinatura',value:['ADVISOR','AUTHORS'],required:['ADVISOR'],options:[{value:'ADVISOR',label:'Orientador'},{value:'AUTHORS',label:'Autores'},{value:'COMMISSION_PRESIDENT',label:'Presidência'}],onChange:()=>{}}));
 assert.doesNotMatch(html,/Remover Orientador|<input/);assert.match(html,/Remover Autores/);assert.match(html,/<select/);assert.match(html,/COMMISSION_PRESIDENT/);
});
