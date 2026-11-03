import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  FeedbackError, checkFeedbackImage, fingerprintFeedbackVisitor,
  submitPublicFeedback, validatePublicFeedback, listFeedbackForAdmins,
} from './publicFeedback';

const png=Buffer.from([137,80,78,71,13,10,26,10,0,0,0,0,73,72,68,82,0,0,0,1,0,0,0,1]).toString('base64');

test('sugestão pública exige texto legível e aceita imagem PNG legítima',()=>{
  const result=validatePublicFeedback({description:'A legenda não aparece em alguns celulares.',imageDataUrl:'data:image/png;base64,'+png});
  assert.equal(result.description,'A legenda não aparece em alguns celulares.');
  assert.equal(result.image?.mime,'image/png');
  assert.equal(result.image?.size,24);
  assert.equal(validatePublicFeedback({description:'Sugestão suficientemente detalhada, sem imagem.'}).image,null);
});

test('recusa conteúdo insuficiente e arquivos SVG ou MIME incompatível',()=>{
  assert.throws(()=>validatePublicFeedback({description:'curto'}),(err:any)=>err instanceof FeedbackError&&err.status===400);
  assert.throws(()=>checkFeedbackImage('data:image/svg+xml;base64,'+png),/PNG, JPEG ou WebP/);
  assert.throws(()=>checkFeedbackImage('data:image/jpeg;base64,'+png),/não corresponde/);
  assert.throws(()=>checkFeedbackImage(17),/até 1,5 MB/);
});

test('campo invisível bloqueia robôs sem inserir uma sugestão',()=>{
  const data=validatePublicFeedback({description:'Mensagem fictícia longa para validação',extraField:'nao-deveria-estar-preenchido'});
  assert.equal(data.suppressed,true);
});

test('fingerprint não expõe IP e depende do segredo do servidor',()=>{
  const first=fingerprintFeedbackVisitor('192.0.2.10','A'.repeat(40));
  assert.match(first,/^[0-9a-f]{64}$/);
  assert.equal(first,fingerprintFeedbackVisitor('192.0.2.10','A'.repeat(40)));
  assert.notEqual(first,fingerprintFeedbackVisitor('192.0.2.11','A'.repeat(40)));
  assert.notEqual(first,fingerprintFeedbackVisitor('192.0.2.10','B'.repeat(40)));
});

test('envio usa API privada e grava apenas após confirmação do banco; lista evita imagem bruta',async()=>{
  const prior={
    SUPABASE_URL:process.env.SUPABASE_URL,
    SUPABASE_SECRET_KEY:process.env.SUPABASE_SECRET_KEY,
    PORTAL_PERSISTENCE_PROVIDER:process.env.PORTAL_PERSISTENCE_PROVIDER,
  };
  const nativeFetch=globalThis.fetch;const calls:Array<{url:string;method:string;body:string}>=[];
  try{
    process.env.SUPABASE_URL='https://example.supabase.co';
    process.env.SUPABASE_SECRET_KEY='sb_secret_fixture';
    process.env.PORTAL_PERSISTENCE_PROVIDER='supabase';
    globalThis.fetch=(async(input:any,opts:any)=>{
      calls.push({url:String(input),method:String(opts?.method||'GET'),body:String(opts?.body||'')});
      const result=opts?.method==='POST'?[{id:'11111111-1111-4111-8111-111111111111',created_at:'2026-11-03T12:00:00Z'}]:[];
      return new Response(JSON.stringify(result),{status:200,headers:{'Content-Type':'application/json'}});
    }) as typeof fetch;
    const answer=await submitPublicFeedback({description:'Uma sugestão objetiva com mais de vinte caracteres.'},'127.0.0.1','x'.repeat(40));
    assert.equal(answer.id,'11111111-1111-4111-8111-111111111111');
    assert.equal(calls.length,2);
    assert.match(calls[0].url,/portal_feedback\?/);
    assert.match(calls[0].url,/ip_fingerprint/);
    assert.equal(calls[1].method,'POST');
    assert.doesNotMatch(calls[1].body,/127\.0\.0\.1/);
    await listFeedbackForAdmins();
    assert.match(calls[2].url,/select=id%2Cdescription%2Cimage_mime%2Cimage_size%2Cstatus%2Ccreated_at%2Creviewed_at/);
    assert.doesNotMatch(calls[2].url,/image_base64/);
  }finally{
    globalThis.fetch=nativeFetch;
    for(const [key,value] of Object.entries(prior)) {
      if(value===undefined)delete process.env[key];else process.env[key]=value;
    }
  }
});

test('botão público e caixa administrativa não dependem de login para abrir sugestões',()=>{
  const sidebar=readFileSync(new URL('../src/components/Sidebar.tsx',import.meta.url),'utf8');
  const modal=readFileSync(new URL('../src/components/FeedbackModal.tsx',import.meta.url),'utf8');
  const server=readFileSync(new URL('../server.ts',import.meta.url),'utf8');
  assert.match(sidebar,/id="bottom-suggestions-btn"/);
  assert.match(sidebar,/setFeedbackMode\('submit'\)/);
  assert.match(modal,/type="file" accept="image\/png,image\/jpeg,image\/webp"/);
  assert.match(modal,/textarea[\s\S]*minLength=\{20\}/);
  assert.match(server,/app\.post\('\/api\/public\/feedback',async/);
  assert.match(server,/app\.get\('\/api\/admin\/feedback',requireAuthenticated,requireAdministrator/);
  assert.match(server,/app\.get\('\/api\/admin\/feedback\/:id\/image',requireAuthenticated,requireAdministrator/);
});
