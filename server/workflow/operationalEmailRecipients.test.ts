import {buildGmailRawMessage} from '../integrations/googleWorkspace';
import {dispatchTrackedEmail,initialEmailDelivery} from '../integrations/trackedGmail';
import type {EmailDeliveryRecord} from '../../src/types/automation';
import {executeWorkflowEvent} from './runtime';
import test from 'node:test';
import assert from 'node:assert/strict';
import {operationalEmailRecipients,invitationEmailCopies} from './operationalEmailRecipients';
import {reservationCopies} from './reservationEmail';
import {processEmailMessage} from '../../src/utils/processEmailMessage';
import {DEMO_PROCESSES} from '../../src/services/demoSeed';
const p={...structuredClone(DEMO_PROCESSES[0]),aluno2:{nome:'Segundo autor',email:'segundo@edu.ufes.br',matricula:'002'}};
const department='department@example.invalid',participants=[p.aluno1.email,p.aluno2.email,p.orientador.email].map(s=>s.toLowerCase());
test('cadastro e agendamento confirmado vão apenas aos autores e orientador',()=>{
 assert.deepEqual(operationalEmailRecipients('email-instrucoes-cadastro',p,department,['wrong@example.invalid']).sort(),participants.sort());
 assert.deepEqual(operationalEmailRecipients('email-confirmacao',p,department,[department,'wrong@example.invalid']).sort(),participants.sort());
 assert.deepEqual(reservationCopies(p,department).sort(),participants.sort());assert.deepEqual(operationalEmailRecipients('email-assinatura-ata',p,department,[p.aluno1.email]).sort(),participants.sort());
 assert.deepEqual(operationalEmailRecipients('custom-notice',p,department,['configured@example.invalid']),['configured@example.invalid']);
});
test('aviso de ata assinada é enviado uma vez aos autores e orientador',async()=>{
 const studio={revision:1,docTemplates:[],formTemplates:[],matrixColumns:[],matrixRows:[],emailTemplates:[{id:'email-entrega-repositorio',recipient:'outro@example.invalid',subject:'Entrega',body:'Prezados autores,'}],workflowStages:[{id:'signed',triggerEvent:'SIGNATURE_COMPLETED',actions:[{id:'delivery',type:'email',refId:'email-entrega-repositorio'}]}]} as any;
 const deliveries:any[]=[];
 const ports={createDocument:async()=>({}),createFormTask:async()=>({}),resolveEmailRecipients:({template,recipients}:any)=>operationalEmailRecipients(template.id,p,department,recipients),sendEmail:async(input:any)=>{deliveries.push(input);return{externalId:'delivery-1'};}};
 const context={process:p,eventCode:'SIGNATURE_COMPLETED',actorEmail:department,actorRoles:[]};
 const run=await executeWorkflowEvent(studio,context,ports);
 assert.equal(run.status,'COMPLETED');assert.equal(deliveries.length,1);assert.deepEqual([...deliveries[0].to].sort(),[...participants].sort());
 await executeWorkflowEvent(studio,{...context,completedActions:run.actions},ports);assert.equal(deliveries.length,1);
});
test('cópia do pedido aos participantes contém só o link do processo, nunca a autorização do departamento',()=>{
 const base={process:p,recipient:p.aluno1.email,templateId:'email-reserva',eventCode:'TCC_CREATED',subject:'Solicitação de reserva',text:'',baseUrl:'https://portal.example',courseName:'Enfermagem'};
 const copy=processEmailMessage(base),action=processEmailMessage({...base,recipient:department,departmentUrl:'https://portal.example/api/reservation-confirmation/scoped-token'});
 assert.doesNotMatch(copy.html,/reservation-confirmation|confirme ou negue/);assert.match(copy.html,/\?tcc=/);assert.equal((copy.html.match(/<a /g)||[]).length,1);
 assert.match(action.html,/reservation-confirmation\/scoped-token/);assert.match(action.text,/aceite ou recuse/);
});
test('local alternativo ocupa parágrafo separado no cadastro recebido',()=>{
 const message=processEmailMessage({process:p,recipient:p.aluno1.email,templateId:'email-instrucoes-cadastro',eventCode:'TCC_CREATED',subject:'Cadastro recebido',text:'Título: Trabalho\nData: 20/11\nLocal: Auditório\nLocal alternativo: Sala de reuniões',baseUrl:'https://portal.example',courseName:'Enfermagem'});
 assert.match(message.text,/Local: Auditório/);assert.doesNotMatch(message.text,/Local alternativo:/);
 assert.match(message.html,/bgcolor="#005830"/);assert.match(message.html,/text-align:center" align="center"/);
});


test('convite coletivo coloca os dois examinadores em Para e somente os demais em Cc',()=>{
 const guests=p.banca.filter(person=>person.funcao!=='ORIENTADOR'&&person.email!==p.orientador.email);
 assert.equal(guests.length,2);
 const to=operationalEmailRecipients('email-convite',p,department,[p.orientador.email,'wrong@example.invalid']);
 assert.deepEqual([...to].sort(),guests.map(person=>person.email.toLowerCase()).sort());
 const master='master@example.invalid';
 const copies=invitationEmailCopies(p,master);
 assert.ok(copies.includes(master));
 assert.ok(to.every(email=>!copies.includes(email)));
 const all=[...to,...copies];
 for(const email of [...participants,...guests.map(person=>person.email.toLowerCase()),...(p.coorientador?.email?[p.coorientador.email.toLowerCase()]:[])])assert.ok(all.includes(email));
 assert.throws(()=>operationalEmailRecipients('email-convite',{...p,banca:[guests[0],guests[0]]},department,[]),/dois convidados/);
 const withCoadvisor={...p,coorientador:{nome:'Coorientador Exemplo',email:'coorientador@example.invalid',siape:'',instituicao:''}};
 assert.ok(invitationEmailCopies(withCoadvisor,master).includes('coorientador@example.invalid'));
});
test('cada convidado recebe o painel completo, com instruções apenas para convidados e um link',()=>{
 for(const recipient of operationalEmailRecipients('email-convite',p,department,[])){
  const message=processEmailMessage({process:p,recipient,templateId:'email-convite',eventCode:'INVITATION_SENT',subject:'Assunto antigo',text:'Corpo antigo com instrução ao orientador.',baseUrl:'https://portal.example',courseName:'Enfermagem'});
  assert.match(message.subject,/Convite para a banca de TCC/);assert.match(message.text,/Prezados,/);assert.ok(message.text.includes(p.orientador.nome));assert.ok(message.text.includes(p.aluno1.nome));assert.ok(message.text.includes(p.aluno2.nome));
  for(const person of p.banca.filter(person=>person.funcao!=='ORIENTADOR'))assert.ok(message.text.includes(person.nome));
  const instructions=message.text.split('ORIENTAÇÕES DO PROCESSO')[1];assert.match(instructions,/Examinadores: usem o botão/);assert.doesNotMatch(instructions,/Participantes:|Orientador:|após a defesa|registre o resultado/);assert.equal((message.html.match(/<a /g)||[]).length,1);
 }
});


test('fluxo resolve os dois convidados antes de personalizar e não repete os envios na retomada',async()=>{
 const studio={revision:1,docTemplates:[],formTemplates:[],matrixColumns:[],matrixRows:[],emailTemplates:[{id:'email-convite',recipient:p.orientador.email,subject:'Convite',body:'Prezado(a) <<DESTINATARIO_NOME>>,'}],workflowStages:[{id:'invitation',triggerEvent:'LOCATION_CONFIRMED',actions:[{id:'send-invitation',type:'email',refId:'email-convite'}]}]} as any;
 const deliveries:any[]=[];
 const ports={createDocument:async()=>({}),createFormTask:async()=>({}),resolveEmailRecipients:({template,recipients}:any)=>operationalEmailRecipients(template.id,p,department,recipients),sendEmail:async(input:any)=>{deliveries.push({...input,cc:invitationEmailCopies(p,'master@example.invalid')});return{externalId:input.to[0]};}};
 const context={process:p,eventCode:'LOCATION_CONFIRMED',actorEmail:department,actorRoles:[]};
 const run=await executeWorkflowEvent(studio,context,ports);assert.equal(run.status,'COMPLETED');assert.equal(deliveries.length,1);assert.equal(deliveries[0].to.length,2);
 for(const delivery of deliveries){const person=p.banca.find(person=>person.email===delivery.to[0])!;assert.ok(person);assert.ok(delivery.text.includes(person.nome));for(const email of participants)assert.ok(delivery.cc.includes(email));}
 await executeWorkflowEvent(studio,{...context,completedActions:run.actions},ports);assert.equal(deliveries.length,1);
});
test('botão do convite mantém destino Documentos para convidados e todas as cópias',()=>{
 const guests=operationalEmailRecipients('email-convite',p,department,[]);
 const recipients=new Set([...guests,...invitationEmailCopies(p,'master@example.invalid')]);
 assert.ok(recipients.size>=5);
 for(const recipient of recipients){
  const message=processEmailMessage({process:p,recipient,templateId:'email-convite',eventCode:'INVITATION_SENT',subject:'Convite',text:'',baseUrl:'https://portal.example',courseName:'Enfermagem'});
  const href=message.html.match(/<a href="([^"]+)"/)![1].replaceAll('&amp;','&');
  const url=new URL(href);assert.equal(url.searchParams.get('tcc'),p.id);assert.equal(url.searchParams.get('secao'),'docs');
  assert.match(message.text,/após o login, essa aba será aberta automaticamente/);
 }
});
test('termo abre Documentos e entrega final abre Repositório para cada responsável',()=>{
 for(const [template,event,section] of [['email-assinatura-termo','REPOSITORY_SUBMITTED','docs'],['email-entrega-repositorio','SIGNATURE_COMPLETED','acervo']] as const){
  for(const recipient of participants){
   const message=processEmailMessage({process:p,recipient,templateId:template,eventCode:event,subject:'Etapa',text:'Mensagem',baseUrl:'https://portal.example',courseName:'Enfermagem'});
   const href=message.html.match(/<a href="([^"]+)"/)![1].replaceAll('&amp;','&'),url=new URL(href);assert.equal(url.searchParams.get('tcc'),p.id);assert.equal(url.searchParams.get('secao'),section);
  }
 }
});

test('MIME envia os dois examinadores uma vez e atualiza uma tentativa antiga sem duplicar convite aceito',async()=>{
 const master='master@example.invalid';
 const [recipient,other]=operationalEmailRecipients('email-convite',p,department,[]);
 const copies=invitationEmailCopies(p,master);
 const message=processEmailMessage({process:p,recipient,templateId:'email-convite',eventCode:'INVITATION_SENT',subject:'Convite',text:'',baseUrl:'https://portal.example',courseName:'Enfermagem'});
 const legacy={recipient,cc:[...copies,other],subject:message.subject,text:'Texto antigo',idempotencyKey:'invitation-existing-action'};
 let record:EmailDeliveryRecord=initialEmailDelivery(legacy,new Date(0));
 const messages:string[]=[];
 const ports={journal:{findByIdempotencyKey:async()=>record,save:async(value:EmailDeliveryRecord)=>{record=value;}},auditCopyEmail:master,
  send:async(input:Parameters<typeof buildGmailRawMessage>[0])=>{messages.push(buildGmailRawMessage(input,'test'));return{id:'fixture-accepted'};}};
 const result=await dispatchTrackedEmail({...legacy,...message,cc:copies,workflowCc:copies,additionalRecipients:[other]},ports);
 assert.equal(result.idempotencyKey,legacy.idempotencyKey);
 assert.equal(result.status,'ACCEPTED_BY_GMAIL');
 assert.deepEqual(result.additionalRecipients,[other]);
 assert.deepEqual(result.cc,copies);
 assert.ok(messages[0].includes(`To: ${recipient}, ${other}\r\nCc: ${copies.join(', ')}\r\n`));
 assert.match(message.text,/Examinadores da banca:\n[^\n]+\n[^\n]+\n\nTítulo:/);
 assert.ok(message.text.includes(`Autor: ${p.aluno1.nome}\nAutor: ${p.aluno2!.nome}`));
 assert.match(message.html,/Autor: [^<]+<br>Autor: /);
 const individual=processEmailMessage({process:{...p,aluno2:null},recipient,templateId:'email-convite',subject:'Convite',text:'',baseUrl:'https://portal.example',courseName:'Enfermagem'});
 assert.equal(individual.text.match(/^Autor: /gm)?.length,1);
 await dispatchTrackedEmail({...legacy,...message,additionalRecipients:[other]},ports);
 assert.equal(messages.length,1);
});
