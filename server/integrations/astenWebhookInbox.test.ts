import test from 'node:test';import assert from 'node:assert/strict';
import {enqueueAstenWebhook,pendingAstenWebhooks,confirmAstenWebhookProcessed,astenWebhookInboxReady} from './astenWebhookInbox';
import {normalizeAstenWebhookEvent} from './astenEventLedger';
test('inbox durável deduplica retorno, filtra pendências e confirma só depois do processamento',async()=>{
  const originalFetch=globalThis.fetch;const prior={url:process.env.SUPABASE_URL,key:process.env.SUPABASE_SERVICE_ROLE_KEY,provider:process.env.PORTAL_PERSISTENCE_PROVIDER};
  const event=normalizeAstenWebhookEvent({payload:{idEnvelope:77,event:'assinado',tokenAPI:'segredo-que-nao-deve-entrar'},jobs:[{id:'job1',processId:'p1',protocol:'PILOTO',documentType:'ATA',providerEnvelopeId:'77',status:'SENT',updatedAt:''}]});
  const calls:Array<{url:string;method:string;body:string}>=[];
  try{
    process.env.SUPABASE_URL='https://pilot.supabase.co';process.env.SUPABASE_SERVICE_ROLE_KEY='fake-key-only-for-test';process.env.PORTAL_PERSISTENCE_PROVIDER='supabase';
    globalThis.fetch=async(url,init)=>{calls.push({url:String(url),method:init?.method||'GET',body:String(init?.body||'')});if(init?.method==='POST')return new Response(JSON.stringify(calls.length===1?[{event}]:[]));if(init?.method==='PATCH')return new Response(null,{status:204});return new Response(JSON.stringify([{event}]));};
    assert.equal(await enqueueAstenWebhook(event),true);assert.equal(await enqueueAstenWebhook(event),false);
    assert.ok(!calls[0].body.includes('segredo-que-nao-deve-entrar'));
    assert.equal((await pendingAstenWebhooks(1,event.id))[0].fingerprint,event.fingerprint);
    assert.ok(calls[2].url.includes('processed_at=is.null'));
    await confirmAstenWebhookProcessed(event);assert.equal(calls.length,3);
    await confirmAstenWebhookProcessed({...event,processedAt:'2026-10-14T12:00:00Z'});assert.equal(calls[3].method,'PATCH');
  }finally{globalThis.fetch=originalFetch;for(const[k,v]of [['SUPABASE_URL',prior.url],['SUPABASE_SERVICE_ROLE_KEY',prior.key],['PORTAL_PERSISTENCE_PROVIDER',prior.provider]] as const){if(v===undefined)delete process.env[k];else process.env[k]=v;}}
});
test('prontidão da inbox falha se tabela ausente, sem grant ou resposta inválida',async()=>{
  const originalFetch=globalThis.fetch;
  const keys=['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','SUPABASE_SECRET_KEY','PORTAL_PERSISTENCE_PROVIDER'] as const;
  const previous=keys.map(key=>process.env[key]);
  try{
    process.env.SUPABASE_URL='https://pilot.supabase.co';process.env.SUPABASE_SERVICE_ROLE_KEY='fake-key-only-for-test';delete process.env.SUPABASE_SECRET_KEY;process.env.PORTAL_PERSISTENCE_PROVIDER='supabase';
    const calls:string[]=[];
    globalThis.fetch=async(url)=>{calls.push(String(url));return new Response('[]');};
    assert.equal(await astenWebhookInboxReady(),true);
    assert.match(calls[0],/select=fingerprint&limit=0/);
    for(const status of [403,404,503]){
      globalThis.fetch=async()=>new Response('{}',{status});
      assert.equal(await astenWebhookInboxReady(),false);
    }
    globalThis.fetch=async()=>new Response('{}');
    assert.equal(await astenWebhookInboxReady(),false);
    globalThis.fetch=async()=>{throw new Error('network');};
    assert.equal(await astenWebhookInboxReady(),false);
    process.env.PORTAL_PERSISTENCE_PROVIDER='local_file';
    assert.equal(await astenWebhookInboxReady(),false);
  }finally{globalThis.fetch=originalFetch;keys.forEach((key,i)=>{if(previous[i]===undefined)delete process.env[key];else process.env[key]=previous[i];});}
});
