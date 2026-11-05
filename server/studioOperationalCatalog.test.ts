import test from 'node:test';import assert from 'node:assert/strict';
import {withOperationalCatalog,OPERATIONAL_EMAIL_CATALOG,OPERATIONAL_EMAIL_ROUTING,operationalEmailVariant} from '../src/utils/studioOperationalCatalog';
import {processEmailMessage} from '../src/utils/processEmailMessage';
import {DEMO_PROCESSES} from '../src/services/demoSeed';
test('catalog identifies eight operational templates and retains the legacy department template and Master edits',()=>{
 const original={emailTemplates:[{id:'email-reserva',body:'Texto do Master',subject:'Reserva'}],formTemplates:[{id:'form-reserva-aluno',title:'Cadastro'}]};
 const result=withOperationalCatalog(original as any);assert.equal(result.emailTemplates.length,9);assert.deepEqual(Object.keys(OPERATIONAL_EMAIL_ROUTING),OPERATIONAL_EMAIL_CATALOG.map(item=>item[0]).filter(id=>id!=='email-resposta-departamento'));assert.equal(result.formTemplates.length,2);assert.equal(result.emailTemplates[0].body,'Texto do Master');assert.deepEqual(withOperationalCatalog(result),result);assert.equal(original.emailTemplates.length,1);
 assert.equal(operationalEmailVariant('email-reserva',false,false),'email-reserva-autores');assert.equal(operationalEmailVariant('email-comprovante-reserva',true,false),'email-comprovante-reserva');assert.equal(operationalEmailVariant('email-comprovante-reserva',false,true),'email-local-indisponivel');
});
test('Master edits to an email variant reach the actual shared delivery renderer',()=>{
 const p=DEMO_PROCESSES[0],catalog=withOperationalCatalog({} as any);const template=catalog.emailTemplates.find((t:any)=>t.id==='email-reserva-autores');template.body='Prezados autores e orientador,\n\nMensagem revisada para <<PROTOCOLO>>.';template.operationalCatalogEditable=true;
 const result=processEmailMessage({process:p,recipient:p.aluno1.email,subject:'Solicitação',text:'Legado',templateId:'email-reserva',eventCode:'TCC_CREATED',baseUrl:'https://example.invalid',courseName:'Curso',studio:catalog});assert.match(result.text,/Mensagem revisada/);assert.ok(result.text.includes(p.protocolo));assert.ok(OPERATIONAL_EMAIL_CATALOG.length===9);
});

test('legacy reservation copy is aligned with the form workflow without overwriting custom text',()=>{
 const result=withOperationalCatalog({emailTemplates:[{id:'email-reserva',recipient:'reservas@example.invalid',body:'Por favor, respondam a este e-mail confirmando.',subject:'Reserva'}],workflowStages:[{id:'s',actions:[{type:'email',refId:'email-assinatura-ata'}]}]} as any);
 assert.match(result.emailTemplates.find((t:any)=>t.id==='email-reserva').body,/Aceite ou recuse/);assert.ok(!result.emailTemplates.find((t:any)=>t.id==='email-reserva').body.includes('respondam a este e-mail'));assert.equal(result.workflowStages[0].actions.length,0);
});

test('operational validation accepts link-only invitation and the post-ata delivery condition',async()=>{
 const {validateCourseStudio}=await import('../src/utils/courseStudioValidator');const {operationalConfig}=await import('../src/utils/operationalConfig');
 const source:any={emailTemplates:[{id:'email-reserva',recipient:'reservas@example.invalid',subject:'Reserva',body:'Pedido'},{id:'email-convite',recipient:'{{BANCA_EMAILS}}',subject:'Convite',body:'Acesse <<LINK_PROCESSO>>',attachments:[]},{id:'delivery',recipient:'{{ALUNO_1_EMAIL}}',subject:'Entrega',body:'Entrega'}],docTemplates:[{id:'convite',type:'CONVITE'}],workflowStages:[{id:'register',triggerEvent:'TCC_CREATED',actions:[{type:'email',refId:'email-reserva'}]},{id:'invite',triggerEvent:'LOCATION_CONFIRMED',actions:[{type:'doc',refId:'convite'},{type:'email',refId:'email-convite'}]},{id:'deliver',triggerEvent:'SIGNATURE_COMPLETED',actions:[{type:'email',refId:'delivery',condition:{fieldKey:'ENTREGA_FINAL_LIBERADA',operator:'IS_TRUE'}}]}]};source.operationalConfig=operationalConfig(source);source.operationalConfig.reservation.locations=['Auditório'];
 const report=validateCourseStudio(source);assert.equal(source.operationalConfig.reservation.departmentEmail,'reservas@example.invalid');assert.deepEqual(report.issues.filter(i=>['INVALID_INVITATION_PIPELINE','INVALID_CONDITION','DEPARTMENT_REQUIRED','RESERVATION_ACTION_REQUIRED'].includes(i.code)),[]);
});


test('configuração antiga da ata migra para três docentes sem recriar envio automático',()=>{
 const previous={workflowStages:[{id:'avaliacao',triggerEvent:'EVALUATION_SUBMITTED',description:'O orientador confere os dados, registra o resultado e escreve o parágrafo variável do parecer.',actions:[{id:'ata',type:'doc',refId:'tmpl-ata',title:'Gera Ata de Defesa e envia à Asten',recipientOrDetail:'Assinatura do orientador'},{id:'aviso',type:'email',refId:'email-assinatura-ata'}]}]};
 const updated=withOperationalCatalog(previous as any);
 const stage=updated.workflowStages[0];
 assert.match(stage.description,/orientador e dos dois examinadores/);
 assert.equal(stage.actions.length,1);assert.equal(stage.actions[0].title,'Prepara Ata de Defesa para assinatura');
 assert.equal(stage.actions[0].recipientOrDetail,'Orientador e dois examinadores · prioridade 1');
 assert.deepEqual(withOperationalCatalog(updated),updated);
 assert.equal(previous.workflowStages[0].actions.length,2);
});
