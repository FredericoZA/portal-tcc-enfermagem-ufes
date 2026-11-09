import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac, randomBytes} from 'node:crypto';
import {OtpResendCooldownError, requestPortalOtp, verifyPortalOtp} from './portalOtp';
import {saveIntegrationSecret} from '../integrations/integrationSecrets';

const recipient = 'student@otp-audit.invalid';
const master = 'current-master@otp-audit.invalid';

async function withDeliveryFixture(run:(fixture:{sent:string[];challenges:Array<Record<string,any>>;rejectDelivery:()=>void})=>Promise<void>) {
  const keys = ['NODE_ENV','VERCEL','SUPABASE_URL','SUPABASE_SECRET_KEY','SUPABASE_SERVICE_ROLE_KEY','PORTAL_ALLOW_LOCAL_OTP_STORE','PORTAL_ALLOW_LOCAL_SECRET_STORE','PORTAL_OTP_PEPPER','PORTAL_OTP_DELIVERY_MODE','PORTAL_SECRET_ENCRYPTION_KEY','PORTAL_SECRET_ENCRYPTION_KEY_V2','GOOGLE_OAUTH_CLIENT_ID','GOOGLE_OAUTH_CLIENT_SECRET'];
  const previous = Object.fromEntries(keys.map(key=>[key,process.env[key]]));
  const previousFetch = globalThis.fetch;
  const sent:string[] = [];
  const challenges:Array<Record<string,any>> = [];
  let storedSecret:unknown;
  let deliveryRejected = false;
  Object.assign(process.env,{NODE_ENV:'test',VERCEL:'',SUPABASE_URL:'https://otp-audit-db.invalid',SUPABASE_SECRET_KEY:'synthetic-secret',SUPABASE_SERVICE_ROLE_KEY:'',PORTAL_ALLOW_LOCAL_OTP_STORE:'false',PORTAL_ALLOW_LOCAL_SECRET_STORE:'false',PORTAL_OTP_PEPPER:randomBytes(40).toString('hex'),PORTAL_OTP_DELIVERY_MODE:'gmail',PORTAL_SECRET_ENCRYPTION_KEY:randomBytes(32).toString('hex'),PORTAL_SECRET_ENCRYPTION_KEY_V2:'',GOOGLE_OAUTH_CLIENT_ID:'synthetic-client',GOOGLE_OAUTH_CLIENT_SECRET:'synthetic-client-secret'});
  globalThis.fetch = async(input,init:RequestInit={})=>{
    const url = new URL(typeof input==='string'||input instanceof URL?String(input):input.url);
    const method = init.method || 'GET';
    if(url.origin==='https://otp-audit-db.invalid'&&url.pathname==='/rest/v1/portal_integration_secrets') {
      if(method==='POST'){storedSecret=JSON.parse(String(init.body));return new Response(null,{status:204});}
      if(method==='GET')return Response.json(storedSecret?[storedSecret]:[]);
    }
    if(url.origin==='https://otp-audit-db.invalid'&&url.pathname==='/rest/v1/portal_otp_challenges') {
      if(method==='POST'){challenges.push(JSON.parse(String(init.body)));return new Response(null,{status:201});}
      const rows = challenges.filter(row=>(!url.searchParams.has('email')||row.email===url.searchParams.get('email')!.slice(3))&&(!url.searchParams.has('id')||row.id===url.searchParams.get('id')!.slice(3))&&(!url.searchParams.has('requested_ip_hash')||row.requested_ip_hash===url.searchParams.get('requested_ip_hash')!.slice(3))&&(!url.searchParams.has('consumed_at')||row.consumed_at===null)&&(!url.searchParams.has('attempts')||row.attempts===Number(url.searchParams.get('attempts')!.slice(3))));
      if(method==='PATCH'){for(const row of rows)Object.assign(row,JSON.parse(String(init.body)));return Response.json(rows);}
      if(method==='GET')return Response.json([...rows].reverse());
    }
    if(url.href==='https://oauth2.googleapis.com/token')return Response.json({access_token:'synthetic-access-token',expires_in:3600});
    if(url.href==='https://gmail.googleapis.com/gmail/v1/users/me/messages/send') {
      if(deliveryRejected)return Response.json({error:{message:'Synthetic Gmail rejection'}},{status:503});
      sent.push(Buffer.from(JSON.parse(String(init.body)).raw,'base64url').toString('utf8'));
      return Response.json({id:`synthetic-message-${sent.length}`});
    }
    throw new Error(`Unexpected network request to ${url.origin}${url.pathname}`);
  };
  try {
    await saveIntegrationSecret('google_workspace','synthetic-refresh-token',{email:'sender@otp-audit.invalid'});
    await run({sent,challenges,rejectDelivery:()=>{deliveryRejected=true;}});
  } finally {
    globalThis.fetch=previousFetch;
    for(const key of keys){if(previous[key]===undefined)delete process.env[key];else process.env[key]=previous[key];}
  }
}

const copiedTo=(raw:string)=>raw.match(/^Cc: (.*)\r?$/m)?.[1].trim().split(/,\s*/)||[];
const bodies=(raw:string)=>[...raw.matchAll(/Content-Transfer-Encoding: base64\r\n\r\n([A-Za-z0-9+/=\r\n]+)\r\n--/g)].map(match=>Buffer.from(match[1].replace(/\s/g,''),'base64').toString('utf8'));

test('OTP com auditoria entrega uma única mensagem com o mesmo código ao destinatário e ao Master atual',async()=>{
  await withDeliveryFixture(async({sent,challenges})=>{
    const id=await requestPortalOtp({email:recipient,auditCopyEmail:`  ${master.toUpperCase()}  `});
    assert.equal(sent.length,1);
    assert.match(sent[0],new RegExp(`^To: ${recipient}$`,'m'));
    assert.deepEqual(copiedTo(sent[0]),[master]);
    const [text,html]=bodies(sent[0]);
    const generatedCode=text.match(/Seu código de acesso é (\d{6})/)?.[1];
    assert.ok(generatedCode);
    assert.ok(html.includes(generatedCode));

    assert.equal(challenges.length,1);
    assert.deepEqual(Object.keys(challenges[0]).sort(),['attempts','code_hash','consumed_at','created_at','email','expires_at','id','max_attempts','requested_ip_hash'].sort());
    assert.equal(challenges[0].code_hash,createHmac('sha256',process.env.PORTAL_OTP_PEPPER!).update(`${id}\n${recipient}\n${generatedCode}`).digest('hex'));
    assert.ok(!JSON.stringify(challenges).includes(generatedCode));
    await verifyPortalOtp({email:recipient,challengeId:id,code:generatedCode});
    await assert.rejects(verifyPortalOtp({email:recipient,challengeId:id,code:generatedCode}));
  });
});

test('OTP sem auditoria não tem cópia e o Master não recebe uma segunda cópia ao acessar sua própria conta',async()=>{
  await withDeliveryFixture(async({sent})=>{
    await requestPortalOtp({email:recipient});
    await requestPortalOtp({email:master,auditCopyEmail:master.toUpperCase()});
    await requestPortalOtp({email:'another@otp-audit.invalid',auditCopyEmail:'new-master@otp-audit.invalid'});
    assert.equal(sent.length,3);
    assert.deepEqual(sent.map(copiedTo),[[],[],['new-master@otp-audit.invalid']]);
  });
});

test('endereço de auditoria inválido e falha de entrega não deixam um desafio OTP utilizável',async()=>{
  await withDeliveryFixture(async({sent,challenges,rejectDelivery})=>{
    await assert.rejects(requestPortalOtp({email:recipient,auditCopyEmail:'master@otp-audit.invalid\r\nBcc: other@otp-audit.invalid'}),/auditoria inválido/);
    assert.equal(sent.length,0);assert.ok(challenges[0].consumed_at);
    await assert.rejects(verifyPortalOtp({email:recipient,challengeId:challenges[0].id,code:'000000'}));
    rejectDelivery();
    await assert.rejects(requestPortalOtp({email:'rejected@otp-audit.invalid',auditCopyEmail:master}),/Synthetic Gmail rejection/);
    assert.ok(challenges[1].consumed_at);assert.equal(sent.length,0);
    await assert.rejects(verifyPortalOtp({email:'rejected@otp-audit.invalid',challengeId:challenges[1].id,code:'000000'}));
  });
});

test('ativar a cópia do OTP preserva a espera de 60 segundos e não provoca um segundo envio',async()=>{
  await withDeliveryFixture(async({sent,challenges})=>{
    await requestPortalOtp({email:recipient,auditCopyEmail:master});
    await assert.rejects(requestPortalOtp({email:recipient,auditCopyEmail:master}),error=>
      error instanceof OtpResendCooldownError&&error.retryAfterSeconds>0&&error.retryAfterSeconds<=60);
    assert.equal(sent.length,1);assert.equal(challenges.length,1);
  });
});
