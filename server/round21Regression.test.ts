import React from 'react';
import {renderToString} from 'react-dom/server';
import {AdvisorEvaluationPanel} from '../src/components/AdvisorEvaluationPanel';
import test from 'node:test';
import assert from 'node:assert/strict';
import {DEMO_PROCESSES,INITIAL_SETTINGS} from '../src/services/demoSeed';
import {processLink,readProcessLink,processWorkflowSection} from '../src/utils/processLink';
import {recipientEmailVariables,upgradeOperationalEmailTemplate} from '../src/utils/operationalEmails';
import {buildProcessVariables,executeWorkflowEvent} from './workflow/runtime';
import {acceptEvaluation,EvaluationError} from './workflow/evaluation';
import {readFileSync} from 'node:fs';
import {previewProcess} from './workflow/modelPreview';
import {buildLegacyLocationRequests} from './integrations/googleDocsRenderer';
const p=structuredClone(DEMO_PROCESSES[0]);p.defesa.startAt='2026-10-23T23:00:00.000Z';p.defesa.local='Sala de reuniões';

test('links únicos preservam ID e seção e não aceitam esquema executável',()=>{
 const first=processLink('https://portal.example/',p.id,'avaliacao');const second=processLink('https://portal.example/','outro');assert.notEqual(first,second);
 assert.deepEqual(readProcessLink(new URL(first).search),{id:p.id,section:'avaliacao'});
 assert.equal(readProcessLink('?tcc=%3Cscript%3E'),null);assert.throws(()=>processLink('javascript:alert(1)','x'));
});
test('texto e data personalizados respeitam o destinatário e o local escolhido',()=>{
 const common=buildProcessVariables({process:p,eventCode:'LOCATION_CONFIRMED',actorEmail:p.orientador.email,actorRoles:[]});
 const first=recipientEmailVariables(p,p.aluno1.email,common,'https://portal.example');
 const advisor=recipientEmailVariables(p,p.orientador.email,common,'https://portal.example');
 assert.equal(first.DESTINATARIO_NOME,p.aluno1.nome);assert.equal(advisor.DESTINATARIO_NOME,p.orientador.nome);
 assert.equal(first.CAMPO_04,'23/10/2026 às 20:00');assert.equal(first.CAMPO_07_LOCAL,'Sala de reuniões');
 assert.match(first.ORIENTACOES_ACESSO,/Dados do processo|confira os dados/);assert.match(advisor.ORIENTACOES_ACESSO,/Avaliação e ata/);
 assert.match(advisor.LINK_PROCESSO,/secao=avaliacao/);assert.match(first.LINK_PROCESSO,/tcc=/);
});
test('modelos antigos recebem saudação pessoal, tratamento formal e instruções sem alterar destinatários',()=>{
 const template={id:'email-convite',recipient:'<<BANCA_EMAILS>>',attachments:['tmpl-convite'],subject:'Convite para Banca Examinadora',body:'Prezado(a),\n\nConvidamos V. Sa. para compor a Comissão Examinadora da defesa de TCC do discente <<CAMPO_01>>, sob orientação de <<CAMPO_03>>.\nAtenciosamente,\nSecretaria'};
 const next=upgradeOperationalEmailTemplate(template);assert.equal(next.recipient,template.recipient);assert.deepEqual(next.attachments,[]);
 assert.match(next.body,/DESTINATARIO_NOME/);assert.match(next.body,/Vossas Senhorias/);assert.match(next.body,/de autoria de/);assert.match(next.body,/ORIENTADOR_TRATAMENTO/);assert.match(next.body,/ORIENTACOES_ACESSO/);
 assert.deepEqual(upgradeOperationalEmailTemplate(next),next);
});
test('prévia antes da defesa não permite concluir a avaliação antecipadamente',()=>{
 const input={resultadoCode:'APROVADO',parecer:'Parecer para conferência.',dataConfirmed:true,expectedDataRevision:p.dataRevision,expectedSchemaRevision:INITIAL_SETTINGS.integrationStudio?.revision||0};
 const now=new Date('2026-10-20T12:00:00Z');assert.doesNotThrow(()=>acceptEvaluation(p,input,INITIAL_SETTINGS,p.orientador.email,now,{previewOnly:true}));
 assert.throws(()=>acceptEvaluation(p,input,INITIAL_SETTINGS,p.orientador.email,now),(error:EvaluationError)=>error.code==='DEFENSE_NOT_STARTED');
});
test('local legado é substituído apenas por texto literal nas cópias e ignora o local já escolhido',()=>{
 const requests=buildLegacyLocationRequests({selected:'Sala de reuniões',alternatives:['Auditório','Sala de reuniões','Auditório']},['tab1']);
 assert.equal(requests.length,1);assert.equal(requests[0].replaceAllText.containsText.text,'Auditório');assert.equal(requests[0].replaceAllText.replaceText,'Sala de reuniões');
});
test('execução efetiva personaliza cada e-mail e corrige apresentação antiga que devolvia ISO',async()=>{
 const studio:any={revision:1,workflowStages:[{id:'s',triggerEvent:'LOCATION_CONFIRMED',actions:[{id:'e',type:'email',refId:'email-confirmacao'}]}],emailTemplates:[{id:'email-confirmacao',recipient:'{{ALUNO_1_EMAIL}}, {{ORIENTADOR_EMAIL}}',subject:'Confirmação',body:'Prezado(a) <<CAMPO_01>>,\nData/Horário: <<CAMPO_04>>\nLocal: <<CAMPO_07_LOCAL>>'}],docTemplates:[],formTemplates:[],operationalConfig:{presentations:{'email-confirmacao':[{source:'CAMPO_04',marker:'CAMPO_04',format:'original',letterCase:'original'}]}}};
 const messages:any[]=[];const run=await executeWorkflowEvent(studio,{process:p,eventCode:'LOCATION_CONFIRMED',actorEmail:p.orientador.email,actorRoles:[]},{createDocument:async()=>({}),createFormTask:async()=>({}),sendEmail:async message=>{messages.push(message);return {externalId:'sent'};}});
 assert.equal(run.status,'COMPLETED',JSON.stringify(run.actions));assert.equal(messages.length,2);
 assert.match(messages[0].text,new RegExp(p.aluno1.nome));assert.match(messages[1].text,new RegExp(p.orientador.nome));
 for(const message of messages){assert.match(message.text,/23\/10\/2026 às 20:00/);assert.doesNotMatch(message.text,/2026-10-23T/);assert.match(message.text,/Sala de reuniões/);assert.equal(message.to.length,1);}
});

test('link público para avaliação mantém dados privados ausentes sem quebrar a tela',()=>{
 const publicProcess={...p,avaliacao:undefined} as any;
 const html=renderToString(React.createElement(AdvisorEvaluationPanel,{process:publicProcess,canEvaluate:false,canReopen:false,onReopen:()=>{},onUpdated:async()=>{}}));
 assert.match(html,/Você não possui permissão/);assert.doesNotMatch(html,/id="evaluation-PARECER"/);
});

test('aba acompanha o avanço do convite até documentos e repositório',()=>{
 for(const [etapaAtual,section] of Object.entries({CADASTRO:'cadastral',CONFIRMACAO_LOCAL:'cadastral',AGENDAMENTO:'cadastral',CONVITE:'cadastral',DEFESA:'avaliacao',AVALIACAO:'avaliacao',ASSINATURA:'avaliacao',DOCUMENTOS:'docs',REPOSITORIO:'acervo',CONCLUIDO:'docs'})){
  assert.equal(processWorkflowSection({...p,etapaAtual,defesa:{...p.defesa,invitationSentAt:undefined}} as any),section);
 }
});

test('botão de amostra envia data de máquina e gera todos os campos canônicos',()=>{
 const source=readFileSync('src/components/MasterDocumentModelsPanel.tsx','utf8');
 const date=source.match(/DEFESA_DATA_HORA: '([^']+)'/)?.[1];
 assert.match(date||'',/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
 const sample=previewProcess(INITIAL_SETTINGS.integrationStudio||{},{DEFESA_DATA_HORA:date!});
 assert.ok(Number.isFinite(Date.parse(sample.process.defesa.startAt)));
 assert.ok(sample.process.aluno1.nome);assert.ok(sample.process.orientador.nome);
});
