import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  FeedbackError, checkFeedbackImage, fingerprintFeedbackVisitor,
  submitPublicFeedback, validatePublicFeedback, listFeedbackForAdmins, listFeedbackPageForAdmin, markFeedbackReviewed,
  feedbackImageForAdmin,
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
  assert.match(sidebar,/sugestoes: \{ id: 'sugestoes'/);
  assert.match(sidebar,/setFeedbackMode\('submit'\)/);
  assert.match(modal,/type="file" accept="image\/png,image\/jpeg,image\/webp"/);
  assert.match(modal,/textarea[\s\S]*minLength=\{20\}/);
  assert.match(server,/app\.post\('\/api\/public\/feedback',async/);
  assert.match(server,/app\.get\('\/api\/admin\/feedback',requireAuthenticated,requireGlobalRoles\('MASTER_ADMIN'\)/);
  assert.match(server,/app\.get\('\/api\/admin\/feedback\/:id\/image',requireAuthenticated,requireGlobalRoles\('MASTER_ADMIN'\)/);
});

test('captura nova é arquivada no Drive e somente referências são gravadas no banco',async()=>{
  let archived=false;let inserted:Record<string,unknown>|undefined;
  await withPrivateFeedbackMock((url,opts)=>{
    if(opts.method==='POST'){
      assert.equal(archived,true);inserted=JSON.parse(String(opts.body));
      return [{id:inserted!.id,created_at:'2026-11-03T12:00:00Z'}];
    }
    return [];
  },async()=>{
    await submitPublicFeedback({description:'Captura de tela para conferir a sugestão.',imageDataUrl:'data:image/png;base64,'+png},'192.0.2.1','x'.repeat(40),async input=>{
      assert.equal(input.kind,'FEEDBACK_IMAGE');assert.equal(input.bytes.length,24);archived=true;
      return {driveFileId:'private_feedback_123',contentSha256:'b'.repeat(64),mimeType:input.mimeType,byteLength:input.bytes.length};
    });
  });
  assert.equal(inserted?.image_base64,undefined);
  assert.equal(inserted?.image_drive_file_id,'private_feedback_123');
  assert.equal(inserted?.image_sha256,'b'.repeat(64));
});

test('captura antiga continua legível e captura Drive usa o leitor privado autorizado',async()=>{
  let row:any={image_mime:'image/png',image_base64:png,image_size:24};
  await withPrivateFeedbackMock(()=>[row],async()=>{
    const id='11111111-1111-4111-8111-111111111111';
    assert.deepEqual((await feedbackImageForAdmin(id))?.bytes,Buffer.from(png,'base64'));
    row={...row,image_base64:null,image_drive_file_id:'private_feedback_123',image_sha256:'b'.repeat(64)};
    const image=await feedbackImageForAdmin(id,async(ref,kind)=>{
      assert.equal(kind,'FEEDBACK_IMAGE');assert.equal(ref.driveFileId,'private_feedback_123');return Buffer.from(png,'base64');
    });
    assert.equal(image?.mime,'image/png');assert.equal(image?.bytes.length,24);
  });
});

async function withPrivateFeedbackMock<T>(handler:(url:URL,options:RequestInit)=>unknown,run:()=>Promise<T>):Promise<T>{
  const prior={SUPABASE_URL:process.env.SUPABASE_URL,SUPABASE_SECRET_KEY:process.env.SUPABASE_SECRET_KEY,PORTAL_PERSISTENCE_PROVIDER:process.env.PORTAL_PERSISTENCE_PROVIDER};
  const nativeFetch=globalThis.fetch;
  try{
    process.env.SUPABASE_URL='https://example.supabase.co';process.env.SUPABASE_SECRET_KEY='sb_secret_fixture';process.env.PORTAL_PERSISTENCE_PROVIDER='supabase';
    globalThis.fetch=(async(input:any,options:RequestInit={})=>new Response(JSON.stringify(handler(new URL(String(input)),options)),{status:200,headers:{'content-type':'application/json'}})) as typeof fetch;
    return await run();
  }finally{globalThis.fetch=nativeFetch;for(const [key,value]of Object.entries(prior)){if(value===undefined)delete process.env[key];else process.env[key]=value;}}
}
const feedbackRow=(id:string)=>({id,description:'Sugestão de melhoria com descrição suficiente.',image_mime:null,image_size:null,status:'NEW' as const,created_at:'2026-11-03T12:00:00.123456+00:00',reviewed_at:null,reviewed_by:null});

test('paginação preserva histórico com desempate por UUID e expõe somente metadados da imagem',async()=>{
  const rows=Array.from({length:101},(_,index)=>feedbackRow(`11111111-1111-4111-8111-${String(200-index).padStart(12,'0')}`));
  const calls:URL[]=[];
  await withPrivateFeedbackMock(url=>{
    calls.push(url);
    assert.equal(url.searchParams.get('limit'),'101');assert.equal(url.searchParams.get('order'),'created_at.desc,id.desc');
    const select=url.searchParams.get('select')||'';assert.match(select,/reviewed_by/);assert.doesNotMatch(select,/image_base64|ip_fingerprint/);
    return calls.length===1?rows:rows.slice(100);
  },async()=>{
    const first=await listFeedbackPageForAdmin();assert.equal(first.items.length,100);assert.ok(first.nextCursor);
    const second=await listFeedbackPageForAdmin(first.nextCursor);assert.equal(second.items.length,1);assert.equal(second.nextCursor,null);
    assert.equal(new Set([...first.items,...second.items].map(row=>row.id)).size,101);
    assert.equal(calls[0].searchParams.has('or'),false);
    assert.equal(calls[1].searchParams.get('or'),`(created_at.lt.${rows[99].created_at},and(created_at.eq.${rows[99].created_at},id.lt.${rows[99].id}))`);
  });
});

test('cursor inválido é rejeitado antes de acessar o banco',async()=>{
  let calls=0;
  await withPrivateFeedbackMock(()=>{calls++;return[];},async()=>{
    const injected=Buffer.from(JSON.stringify({createdAt:'2026-11-03T12:00:00Z),status.eq.NEW',id:'11111111-1111-4111-8111-111111111111'})).toString('base64url');
    for(const cursor of ['',[],{},'=', 'a'.repeat(241),injected])await assert.rejects(()=>listFeedbackPageForAdmin(cursor),(error:any)=>error instanceof FeedbackError&&error.status===400);
  });
  assert.equal(calls,0);
});

test('análise retorna data e responsável confirmados pelo banco e preserva a primeira análise',async()=>{
  const original={...feedbackRow('11111111-1111-4111-8111-111111111111'),status:'REVIEWED' as const,reviewed_at:'2026-11-03T12:01:02Z',reviewed_by:'master-original@example.invalid'};
  let patches=0;const calls:Array<{url:URL;options:RequestInit}>=[];
  await withPrivateFeedbackMock((url,options)=>{
    calls.push({url,options});
    if(options.method==='PATCH'){
      patches++;assert.equal(url.searchParams.get('status'),'eq.NEW');assert.match(url.searchParams.get('select')||'',/reviewed_by/);
      assert.equal(JSON.parse(String(options.body)).reviewed_by,'master-atual@example.invalid');
      return patches===1?[original]:[];
    }
    return[original];
  },async()=>{
    assert.deepEqual(await markFeedbackReviewed(original.id,'master-atual@example.invalid'),original);
    assert.deepEqual(await markFeedbackReviewed(original.id,'master-atual@example.invalid'),original);
    assert.equal(calls.length,3);assert.equal(calls[2].url.searchParams.get('id'),'eq.'+original.id);
  });
});

test('análise inexistente retorna ausência e identificador inválido não chega ao banco',async()=>{
  let calls=0;
  await withPrivateFeedbackMock(()=>{calls++;return[];},async()=>{
    assert.equal(await markFeedbackReviewed('11111111-1111-4111-8111-111111111111','master@example.invalid'),null);
    await assert.rejects(()=>markFeedbackReviewed('------------------------------------','master@example.invalid'),(error:any)=>error.status===400);
  });assert.equal(calls,2);
});
