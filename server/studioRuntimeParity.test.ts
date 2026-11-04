import test from 'node:test';
import assert from 'node:assert/strict';
import {studioEditableEmail,studioEmailPreview,studioSampleProcess} from '../src/utils/studioRuntimePreview';
import {withOperationalCatalog} from '../src/utils/studioOperationalCatalog';
import {processEmailMessage} from '../src/utils/processEmailMessage';
import {reservationConfirmationView,reservationPage} from '../src/utils/reservationConfirmationView';
import {mergeStudioDraft} from '../src/utils/studioDraftMerge';
import {upgradeOperationalEmailTemplate} from '../src/utils/operationalEmails';
import {createReservationReceiptPdf} from './documents/reservationReceipt';
import {INITIAL_SETTINGS} from '../src/services/demoSeed';
import {PDFDocument} from 'pdf-lib';

test('preview and tracked dispatch use the same message including both decision buttons',()=>{
 const studio=withOperationalCatalog({} as Partial<import('../src/types/integrationStudio').IntegrationStudioSettings>);const p=studioSampleProcess();
 const template=studio.emailTemplates!.find(t=>t.id==='email-reserva')!;
 const real=processEmailMessage({process:p,studio,recipient:'mariana@example.invalid',subject:String(template.subject),text:String(template.body),templateId:'email-reserva',eventCode:'TCC_CREATED',baseUrl:'https://portal.example.invalid',courseName:'Curso de Graduação em Enfermagem e Obstetrícia',departmentUrl:'https://portal.example.invalid/api/reservation-confirmation/amostra-sem-validade'});
 assert.equal(studioEmailPreview(studio,'email-reserva').html,real.html);
 assert.match(real.html,/Aceitar reserva/);assert.match(real.html,/Recusar reserva/);
 const copy=studioEmailPreview(studio,'email-reserva-autores');assert.doesNotMatch(copy.html,/decision=accept|decision=decline/);
});
test('customizing any effective operational message retains variables and reaches dispatch',()=>{
 const studio=withOperationalCatalog({} as Partial<import('../src/types/integrationStudio').IntegrationStudioSettings>);
 for(const id of ['email-reserva','email-convite','email-comprovante-reserva','email-local-indisponivel','email-entrega-repositorio']){
  const editable=studioEditableEmail(studio,id)!;
  assert.doesNotMatch(String(editable.body),/example\.invalid|Mariana Alves|Lucas Pereira|20\/11\/2026|14:00|DEMO00/);
  studio.emailTemplates=studio.emailTemplates!.map(t=>t.id===id?{...editable,subject:'Assunto revisto <<PROTOCOLO>>',body:String(editable.body)+'\nTexto aprovado pelo Master.',operationalCatalogEditable:true}:t);
  const message=studioEmailPreview(studio,id);
  assert.match(message.subject,/Assunto revisto TCC-2026-0001/);assert.match(message.html,/Texto aprovado pelo Master/);
  assert.doesNotMatch(message.html,/&lt;&lt;[A-Z_0-9]+&gt;&gt;/);
 }
});
test('explicitly customized text is not overwritten by a later catalog upgrade',()=>{
 const original={id:'email-convite',body:'Texto institucional revisado.',operationalCatalogEditable:true};
 assert.deepEqual(upgradeOperationalEmailTemplate(original),original);
 const studio=withOperationalCatalog({formTemplates:[{id:'form-reserva-departamento',title:'Responder pedido',description:'Confira a disponibilidade.',targetRole:'Aluno',questions:[]}]});
 assert.equal(studio.formTemplates![0].title,'Responder pedido');assert.equal(studio.formTemplates![0].description,'Confira a disponibilidade.');assert.equal(studio.formTemplates![0].targetRole,'Departamento ou orientador');
 const view=reservationConfirmationView({process:studioSampleProcess(),studio,action:'/real',preview:true});
 const html=reservationPage(view.title,view.content,true);assert.match(html,/Responder pedido/);assert.match(html,/Confira a disponibilidade/);assert.match(html,/disabled aria-disabled/);assert.doesNotMatch(html,/<script/);
 const attack=reservationConfirmationView({process:studioSampleProcess(),studio:{formTemplates:[{id:'form-reserva-departamento',title:'<script>alert(1)</script>',description:'<img onerror=alert(1)>'}]},action:'" onclick="oops'});
 assert.doesNotMatch(reservationPage(attack.title,attack.content,true),/<script>alert|<img onerror/);
});
test('simultaneous form and email edits merge by identity without losing independent fields',()=>{
 for(const key of ['formTemplates','emailTemplates']){
  const base={[key]:[{id:'a',title:'A',description:'D'},{id:'b',title:'B'}]};const local=structuredClone(base),remote=structuredClone(base);
  local[key][0].title='Local';remote[key][1].title='Remoto';
  assert.deepEqual(mergeStudioDraft(base,local,remote)[key].map(t=>t.title),['Local','Remoto']);
  remote[key][0].title='Conflito';assert.throws(()=>mergeStudioDraft(base,local,remote),/alterações simultâneas/);
 }
});
test('receipt PDF uses configured presentation and preserves the decision and attribution',async()=>{
 const p=studioSampleProcess();p.defesa.departmentResponse={decision:'UNAVAILABLE',revision:0,respondedBy:'secretaria@example.invalid',respondedAt:'2026-11-04T15:41:00Z',startAt:p.defesa.startAt,endAt:p.defesa.endAt};
 const settings={...INITIAL_SETTINGS,integrationStudio:{...INITIAL_SETTINGS.integrationStudio,receiptDesign:{declinedTitle:'Retorno do pedido de sala',declinedText:'Combine uma nova proposta antes de reenviar.'}}} as any;
 const pdf=await PDFDocument.load(await createReservationReceiptPdf(p,settings));
 assert.equal(pdf.getTitle(),'TCC-2026-0001 - Retorno do pedido de sala');assert.equal(pdf.getPageCount(),1);
 assert.equal(p.defesa.departmentResponse.decision,'UNAVAILABLE');
});
