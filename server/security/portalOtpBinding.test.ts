import test from 'node:test';
import assert from 'node:assert/strict';
import {OtpResendCooldownError, requestPortalOtp, verifyPortalOtp, setOtpChallengeCookie, readOtpChallengeCookie} from './portalOtp';
test('tentativas de outro navegador não consomem o desafio legítimo; uso único permanece',async(t)=>{
 const keys=['NODE_ENV','SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','SUPABASE_SECRET_KEY','PORTAL_ALLOW_LOCAL_OTP_STORE','PORTAL_OTP_PEPPER','PORTAL_OTP_DELIVERY_MODE'];
 const previous=Object.fromEntries(keys.map(k=>[k,process.env[k]]));const info=console.info;
 try{
  Object.assign(process.env,{NODE_ENV:'test',SUPABASE_URL:'',SUPABASE_SERVICE_ROLE_KEY:'',SUPABASE_SECRET_KEY:'',PORTAL_ALLOW_LOCAL_OTP_STORE:'true',PORTAL_OTP_PEPPER:'a'.repeat(40),PORTAL_OTP_DELIVERY_MODE:'log'});
  let deliveredCode:string|undefined;console.info=(value:string)=>{deliveredCode=value.match(/\d{6}$/)?.[0];};
  const email='binding@example.invalid';const challengeId=await requestPortalOtp({email});
  const code=deliveredCode;assert.ok(code);
  await assert.rejects(requestPortalOtp({email,browserChallengeId:challengeId}),error=>
    error instanceof OtpResendCooldownError&&error.canVerifyExistingCode&&error.retryAfterSeconds>0&&error.retryAfterSeconds<=60);
  await assert.rejects(requestPortalOtp({email,browserChallengeId:'b'.repeat(24)}),error=>
    error instanceof OtpResendCooldownError&&!error.canVerifyExistingCode);
  for(let n=0;n<5;n++)await assert.rejects(verifyPortalOtp({email,code:'000000',challengeId:'b'.repeat(24)}));
  await assert.rejects(verifyPortalOtp({email,code,challengeId:''}));
  await verifyPortalOtp({email,code,challengeId});
  await assert.rejects(requestPortalOtp({email,browserChallengeId:challengeId}),error=>
    error instanceof OtpResendCooldownError&&!error.canVerifyExistingCode);
  await assert.rejects(verifyPortalOtp({email,code,challengeId}));
  let cookie:any;setOtpChallengeCookie({cookie:(name:string,value:string,options:any)=>{cookie={name,value,options};}} as any,challengeId);
  assert.equal(cookie.options.httpOnly,true);assert.equal(cookie.options.sameSite,'lax');assert.equal(cookie.options.path,'/api');
  assert.equal(readOtpChallengeCookie({headers:{cookie:`other=x; ${cookie.name}=${cookie.value}`}} as any),challengeId);
  t.mock.timers.enable({apis:['Date'],now:Date.now()});
  const resendEmail='resend@example.invalid';
  const first=await requestPortalOtp({email:resendEmail});
  t.mock.timers.tick(59_000);
  await assert.rejects(requestPortalOtp({email:resendEmail,browserChallengeId:first}),error=>
    error instanceof OtpResendCooldownError&&error.canVerifyExistingCode&&error.retryAfterSeconds===1);
  t.mock.timers.tick(1_000);
  const resent=await requestPortalOtp({email:resendEmail,browserChallengeId:first});
  assert.notEqual(resent,first);
  t.mock.timers.tick(600_000);
  await assert.rejects(verifyPortalOtp({email:resendEmail,code:deliveredCode!,challengeId:resent}), /Código inválido ou expirado/);

 }finally{console.info=info;for(const k of keys){if(previous[k]===undefined)delete process.env[k];else process.env[k]=previous[k];}}
});

// Mount the actual request/verify handlers, with no new product route or auth override.
// Only access-list lookup, minimum response delay and the external delivery port are isolated.
test('HTTP OTP: ACK sem recebimento não autentica; inválido, expirado e falha de envio não criam sessão',async(t)=>{
 const [{default:express},{readFileSync},{runInNewContext},{default:ts},{normalizeEmail},{assertPortalSessionConfigured,setPortalSessionCookie}]=await Promise.all([
  import('express'),import('node:fs'),import('node:vm'),import('typescript'),import('../../src/utils/formatters'),import('./firebaseAuth'),
 ]);
 const keys=['NODE_ENV','VERCEL','SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','SUPABASE_SECRET_KEY','PORTAL_ALLOW_LOCAL_OTP_STORE','PORTAL_PERSISTENCE_PROVIDER','PORTAL_OTP_PEPPER','PORTAL_OTP_DELIVERY_MODE','PORTAL_SESSION_SECRET'];
 const previous=Object.fromEntries(keys.map(k=>[k,process.env[k]]));const info=console.info;
 const app=express();app.use(express.json());let listener:ReturnType<typeof app.listen>|undefined;
 try{
  Object.assign(process.env,{NODE_ENV:'test',VERCEL:'',SUPABASE_URL:'',SUPABASE_SERVICE_ROLE_KEY:'',SUPABASE_SECRET_KEY:'',PORTAL_ALLOW_LOCAL_OTP_STORE:'true',PORTAL_PERSISTENCE_PROVIDER:'local_file',PORTAL_OTP_PEPPER:'otp-http-pepper-0123456789abcdefghijkl',PORTAL_OTP_DELIVERY_MODE:'log',PORTAL_SESSION_SECRET:'otp-http-session-0123456789abcdefghijkl'});
  const codes=new Map<string,string>();console.info=(value:string)=>{const match=String(value).match(/\] ([^:]+): (\d{6})$/);if(match)codes.set(match[1],match[2]);};
  const source=readFileSync('server.ts','utf8');const start=source.indexOf("  app.post('/api/auth/request-code'");const end=source.indexOf("  app.post('/api/auth/logout'",start);assert.ok(start>0&&end>start);
  const emailStart=source.indexOf('function isValidPortalEmail(');const emailValidator=source.slice(emailStart,source.indexOf('\n}',emailStart)+2);
  const isValidPortalEmail=runInNewContext(ts.transpileModule('('+emailValidator+')',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,{normalizeEmail});
  const context={app,Date,Error,normalizeEmail,isValidPortalEmail,allowOtpRequestFromIp:()=>true,canRequestPortalAccess:(email:string)=>email.endsWith('@example.invalid'),
   enforceMinimumResponseTime:async()=>{},currentSettings:{},resolveInstallationProfile:()=>({portalName:'Portal fictício'}),readOtpChallengeCookie,setOtpChallengeCookie,OtpResendCooldownError,verifyPortalOtp,assertPortalSessionConfigured,setPortalSessionCookie,
   requestAuditedPortalOtp:async(input:Parameters<typeof requestPortalOtp>[0])=>{if(input.email==='delivery-failure@example.invalid')throw Error('Entrega sintética recusada');return requestPortalOtp(input);},
   getUserRolesForEmail:()=>({globalRoles:[],memberships:[]}),
  };
  runInNewContext(ts.transpileModule(source.slice(start,end),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,context);
  listener=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>listener!.once('listening',resolve));const address=listener.address();assert.ok(address&&typeof address!=='string');const base=`http://127.0.0.1:${address.port}`;
  const post=(route:string,body:unknown,cookie='')=>fetch(base+route,{method:'POST',headers:{'content-type':'application/json',cookie},body:JSON.stringify(body)});
  const noSession=(response:Response)=>assert.doesNotMatch(response.headers.get('set-cookie')||'',/portal_tcc_session=/);
  const email='ack-without-receipt@example.invalid';const ack=await post('/api/auth/request-code',{email});assert.equal(ack.status,200);assert.equal((await ack.json()).sent,true);noSession(ack);
  const cookie=(ack.headers.get('set-cookie')||'').split(';')[0];assert.ok(cookie);const code=codes.get(email);assert.ok(code);
  const unknown=await post('/api/auth/verify-code',{email,code:'123'},cookie);assert.equal(unknown.status,401);noSession(unknown);
  const wrong=await post('/api/auth/verify-code',{email,code:code==='000000'?'000001':'000000'},cookie);assert.equal(wrong.status,401);noSession(wrong);
  const valid=await post('/api/auth/verify-code',{email,code},cookie);assert.equal(valid.status,200);assert.equal((await valid.json()).isAuthenticated,true);assert.match(valid.headers.get('set-cookie')||'',/portal_tcc_session=/);
  const replay=await post('/api/auth/verify-code',{email,code},cookie);assert.equal(replay.status,401);noSession(replay);
  const expiryEmail='expired-http@example.invalid';const expiry=await post('/api/auth/request-code',{email:expiryEmail});assert.equal(expiry.status,200);noSession(expiry);const expiryCookie=(expiry.headers.get('set-cookie')||'').split(';')[0];const expiryCode=codes.get(expiryEmail);assert.ok(expiryCode);
  t.mock.timers.enable({apis:['Date'],now:Date.now()});t.mock.timers.tick(601_000);
  const expired=await post('/api/auth/verify-code',{email:expiryEmail,code:expiryCode},expiryCookie);assert.equal(expired.status,401);noSession(expired);
  const failure=await post('/api/auth/request-code',{email:'delivery-failure@example.invalid'});assert.equal(failure.status,503);assert.equal((await failure.json()).error,'Entrega sintética recusada');noSession(failure);assert.equal(failure.headers.get('set-cookie'),null);
  const withoutChallenge=await post('/api/auth/verify-code',{email:'delivery-failure@example.invalid',code:'123456'});assert.equal(withoutChallenge.status,401);noSession(withoutChallenge);
 }finally{
  if(listener)await new Promise<void>((resolve,reject)=>listener!.close(error=>error?reject(error):resolve()));
  console.info=info;for(const k of keys){if(previous[k]===undefined)delete process.env[k];else process.env[k]=previous[k];}
 }
});
