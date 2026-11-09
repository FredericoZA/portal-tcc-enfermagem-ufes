import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGmailRawMessage, getGoogleWorkspaceAccessToken, persistGoogleWorkspaceAuthorization, sendGmailMessage } from './googleWorkspace';
import {deleteIntegrationSecret,saveIntegrationSecret} from './integrationSecrets';
import {GmailDeliveryError} from './gmailDeliveryError';

test('gera mensagem MIME com corpo alternativo e PDF anexado', () => {
  const raw = buildGmailRawMessage({
    to: 'destino@ufes.br',
    subject: 'Convite\r\nBcc: invasor@exemplo.com',
    text: 'Texto simples',
    html: '<p>Texto HTML</p>',
    attachments: [{ fileName: 'convite.pdf', mimeType: 'application/pdf', content: Buffer.from('%PDF-teste') }]
  }, 'teste');
  assert.match(raw, /multipart\/mixed; boundary="portal-tcc-mixed-teste"/);
  assert.match(raw, /multipart\/alternative; boundary="portal-tcc-alt-teste"/);
  assert.match(raw, /Content-Disposition: attachment; filename="convite\.pdf"/);
  assert.match(raw, /JVBERi10ZXN0ZQ==/);
  assert.doesNotMatch(raw, /\r\nBcc:/);
});

test('bloqueia anexos acima do limite seguro', () => {
  assert.throws(() => buildGmailRawMessage({
    to: 'destino@ufes.br', subject: 'Teste', text: 'Teste',
    attachments: [{ fileName: 'grande.pdf', mimeType: 'application/pdf', content: Buffer.alloc(20 * 1024 * 1024 + 1) }]
  }, 'limite'), /20 MB/);
});


test('HTML institucional mantém cores, alinhamento e acentos no MIME enviado ao Gmail',()=>{
 const html='<table><tr><td bgcolor="#005830" style="background-color:#005830;text-align:center">Curso de Graduação em Enfermagem e Obstetrícia</td></tr></table>'+('Texto com acentuação. '.repeat(120));
 const raw=buildGmailRawMessage({to:'department@example.invalid',subject:'Reserva',text:'Confirmação da reserva.',html},'institucional');
 const part=raw.split('--portal-tcc-alt-institucional')[2];
 assert.match(part,/Content-Type: text\/html; charset="UTF-8"/);assert.match(part,/Content-Transfer-Encoding: base64/);
 const encoded=part.split('\r\n\r\n')[1].trim();assert.equal(Buffer.from(encoded.replaceAll('\r\n',''),'base64').toString('utf8'),html);assert.ok(encoded.split('\r\n').every(line=>line.length<=76));
});

test('reply MIME keeps message identifiers for the original Gmail conversation',()=>{
 const raw=buildGmailRawMessage({to:'department@example.invalid',cc:['author@example.invalid'],subject:'Solicitação de reserva',text:'Reserva confirmada.',messageId:'reply@portal-tcc.local',inReplyTo:'request@portal-tcc.local',threadId:'gmail-thread'},'reply');
 assert.match(raw,/Message-ID: <reply@portal-tcc.local>/);
 assert.match(raw,/In-Reply-To: <request@portal-tcc.local>/);
 assert.match(raw,/References: <request@portal-tcc.local>/);
 assert.match(raw,/Cc: author@example.invalid/);
});

test('envio retorna a conta Google autenticada sem pedir perfil nem carregar outra credencial', async t => {
 const keys=['NODE_ENV','PORTAL_ALLOW_LOCAL_SECRET_STORE','SUPABASE_URL','SUPABASE_SECRET_KEY','SUPABASE_SERVICE_ROLE_KEY','GOOGLE_OAUTH_CLIENT_ID','GOOGLE_OAUTH_CLIENT_SECRET'];
 const previous=Object.fromEntries(keys.map(key=>[key,process.env[key]]));
 process.env.NODE_ENV='development';process.env.PORTAL_ALLOW_LOCAL_SECRET_STORE='true';
 for(const key of ['SUPABASE_URL','SUPABASE_SECRET_KEY','SUPABASE_SERVICE_ROLE_KEY'])delete process.env[key];
 process.env.GOOGLE_OAUTH_CLIENT_ID='synthetic-client';process.env.GOOGLE_OAUTH_CLIENT_SECRET='synthetic-client-secret';
 t.after(async()=>{await deleteIntegrationSecret('google_workspace');for(const [key,value]of Object.entries(previous)){if(value===undefined)delete process.env[key];else process.env[key]=value;}});
 await persistGoogleWorkspaceAuthorization({email:' Portal@Example.Invalid ',refreshToken:'synthetic-refresh',scopes:['gmail.send']});
 const calls:string[]=[];
 t.mock.method(globalThis,'fetch',async(input:unknown,init?:RequestInit)=>{
  const url=String(input);calls.push(url);
  if(url==='https://oauth2.googleapis.com/token'){
   assert.equal(String(init?.body).includes('refresh_token=synthetic-refresh'),true);
   return new Response(JSON.stringify({access_token:'synthetic-access'}),{status:200});
  }
  assert.equal(url,'https://gmail.googleapis.com/gmail/v1/users/me/messages/send');
  assert.equal(new Headers(init?.headers).get('Authorization'),'Bearer synthetic-access');
  const body=JSON.parse(String(init?.body)),raw=Buffer.from(body.raw,'base64url').toString('utf8');assert.match(raw,/To: author@example.invalid/);
  return new Response(JSON.stringify({id:'accepted-message',threadId:'accepted-thread'}),{status:200});
 });
 const result=await sendGmailMessage({to:'author@example.invalid',subject:'Comprovante',text:'Reserva recusada.'});
 assert.deepEqual(result,{id:'accepted-message',threadId:'accepted-thread',sender:'portal@example.invalid'});
 assert.deepEqual(calls,['https://oauth2.googleapis.com/token','https://gmail.googleapis.com/gmail/v1/users/me/messages/send']);
 assert.equal(await getGoogleWorkspaceAccessToken(),'synthetic-access','o contrato público continua retornando somente o token');
 assert.equal(calls.length,3);
 await saveIntegrationSecret('google_workspace','synthetic-refresh',{});
 assert.equal((await sendGmailMessage({to:'author@example.invalid',subject:'Aviso',text:'Teste'})).sender,undefined,'não inventa remetente para conexões antigas sem e-mail registrado');
});

test('distingue falha anterior ao POST, rejeição explícita e retorno incerto do Gmail',async t=>{
 const keys=['NODE_ENV','PORTAL_ALLOW_LOCAL_SECRET_STORE','SUPABASE_URL','SUPABASE_SECRET_KEY','SUPABASE_SERVICE_ROLE_KEY','GOOGLE_OAUTH_CLIENT_ID','GOOGLE_OAUTH_CLIENT_SECRET'];
 const previous=Object.fromEntries(keys.map(key=>[key,process.env[key]]));
 process.env.NODE_ENV='development';process.env.PORTAL_ALLOW_LOCAL_SECRET_STORE='true';
 for(const key of ['SUPABASE_URL','SUPABASE_SECRET_KEY','SUPABASE_SERVICE_ROLE_KEY'])delete process.env[key];
 process.env.GOOGLE_OAUTH_CLIENT_ID='synthetic-client';process.env.GOOGLE_OAUTH_CLIENT_SECRET='synthetic-client-secret';
 t.after(async()=>{await deleteIntegrationSecret('google_workspace');for(const [key,value]of Object.entries(previous)){if(value===undefined)delete process.env[key];else process.env[key]=value;}});
 await persistGoogleWorkspaceAuthorization({email:'portal@example.invalid',refreshToken:'synthetic-refresh',scopes:['gmail.send']});
 let mode='credentials',providerCalls=0;
 t.mock.method(globalThis,'fetch',async(input:unknown)=>{
  if(String(input)==='https://oauth2.googleapis.com/token')return mode==='credentials'?new Response(JSON.stringify({error:'temporarily_unavailable'}),{status:503}):new Response(JSON.stringify({access_token:'synthetic-access'}),{status:200});
  assert.equal(String(input),'https://gmail.googleapis.com/gmail/v1/users/me/messages/send');providerCalls++;
  if(mode==='timeout')throw Error('Timeout aguardando o resultado do POST');
  if(mode==='incomplete')return Response.json({threadId:'thread-sem-mensagem'});
  if(mode==='malformed')return new Response('<html>erro no intermediário</html>',{status:200});
  return new Response(JSON.stringify({error:{message:'Quota excedida'}}),{status:429});
 });
 const input={to:'author@example.invalid',subject:'Aviso',text:'Teste fictício'};
 await assert.rejects(sendGmailMessage(input),error=>error instanceof GmailDeliveryError&&error.deliveryOutcome==='NOT_SENT');assert.equal(providerCalls,0);
 mode='rejected';await assert.rejects(sendGmailMessage(input),error=>error instanceof GmailDeliveryError&&error.deliveryOutcome==='REJECTED'&&error.providerStatus===429);assert.equal(providerCalls,1);
 mode='timeout';await assert.rejects(sendGmailMessage(input),error=>error instanceof GmailDeliveryError&&error.deliveryOutcome==='UNCERTAIN');assert.equal(providerCalls,2);
 mode='invalid-content';await assert.rejects(sendGmailMessage({...input,cc:['invalid-address']}),error=>error instanceof GmailDeliveryError&&error.deliveryOutcome==='NOT_SENT');assert.equal(providerCalls,2);
 for (const unknownResult of ['incomplete','malformed']) {
  mode=unknownResult;
  await assert.rejects(sendGmailMessage(input),error=>error instanceof GmailDeliveryError&&error.deliveryOutcome==='UNCERTAIN');
 }
 assert.equal(providerCalls,4);
});
