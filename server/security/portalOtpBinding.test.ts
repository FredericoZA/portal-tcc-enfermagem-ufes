import test from 'node:test';
import assert from 'node:assert/strict';
import {requestPortalOtp, verifyPortalOtp, setOtpChallengeCookie, readOtpChallengeCookie} from './portalOtp';
test('tentativas de outro navegador não consomem o desafio legítimo; uso único permanece',async()=>{
 const keys=['NODE_ENV','SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','SUPABASE_SECRET_KEY','PORTAL_ALLOW_LOCAL_OTP_STORE','PORTAL_OTP_PEPPER','PORTAL_OTP_TEST_CODE','PORTAL_OTP_DELIVERY_MODE'];
 const previous=Object.fromEntries(keys.map(k=>[k,process.env[k]]));const info=console.info;
 try{
  Object.assign(process.env,{NODE_ENV:'test',SUPABASE_URL:'',SUPABASE_SERVICE_ROLE_KEY:'',SUPABASE_SECRET_KEY:'',PORTAL_ALLOW_LOCAL_OTP_STORE:'true',PORTAL_OTP_PEPPER:'a'.repeat(40),PORTAL_OTP_TEST_CODE:'123456',PORTAL_OTP_DELIVERY_MODE:'log'});console.info=()=>{};
  const email='binding@example.invalid';const challengeId=await requestPortalOtp({email});
  for(let n=0;n<5;n++)await assert.rejects(verifyPortalOtp({email,code:'000000',challengeId:'b'.repeat(24)}));
  await assert.rejects(verifyPortalOtp({email,code:'123456',challengeId:''}));
  await verifyPortalOtp({email,code:'123456',challengeId});
  await assert.rejects(verifyPortalOtp({email,code:'123456',challengeId}));
  let cookie:any;setOtpChallengeCookie({cookie:(name:string,value:string,options:any)=>{cookie={name,value,options};}} as any,challengeId);
  assert.equal(cookie.options.httpOnly,true);assert.equal(cookie.options.sameSite,'lax');assert.equal(cookie.options.path,'/api');
  assert.equal(readOtpChallengeCookie({headers:{cookie:`other=x; ${cookie.name}=${cookie.value}`}} as any),challengeId);
 }finally{console.info=info;for(const k of keys){if(previous[k]===undefined)delete process.env[k];else process.env[k]=previous[k];}}
});
