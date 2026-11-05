import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import sharp from 'sharp';
import {createPortalHttpApp} from './httpApp';
import handler from './vercel/runtime-asset';

async function withAssetServer(run:(input:{request:(route:string,method?:string)=>Promise<Response>;upstream:Array<{url:string;method:string}>;setRows:(rows:unknown[],status?:number)=>void;downstream:()=>number})=>Promise<void>){
 const originalFetch=globalThis.fetch;
 const previous={SUPABASE_URL:process.env.SUPABASE_URL,SUPABASE_SECRET_KEY:process.env.SUPABASE_SECRET_KEY,SUPABASE_SERVICE_ROLE_KEY:process.env.SUPABASE_SERVICE_ROLE_KEY};
 process.env.SUPABASE_URL='https://runtime-asset-fixture.invalid';process.env.SUPABASE_SECRET_KEY='sb_secret_' + 'runtime_asset_fixture';delete process.env.SUPABASE_SERVICE_ROLE_KEY;
 const upstream:Array<{url:string;method:string}>=[];
 let rows:unknown[]=[],status=200,downstream=0;
 globalThis.fetch=async(url,init)=>{
  const target=String(url);assert.ok(target.startsWith('https://runtime-asset-fixture.invalid/rest/v1/portal_runtime_assets?'));
  upstream.push({url:target,method:String(init?.method||'GET')});
  return Response.json(rows,{status});
 };
 const app=createPortalHttpApp();
 app.all('/api/public/runtime-assets/:key',handler);
 app.all('/api/runtime-asset',handler);
 app.use((_req,res)=>{downstream++;res.status(500).json({error:'Downstream authentication/state must not run.'});});
 const server=app.listen(0,'127.0.0.1');
 try{
  await new Promise<void>(resolve=>server.once('listening',resolve));
  const address=server.address();assert.ok(address&&typeof address!=='string');
  const base=`http://127.0.0.1:${address.port}`;
  await run({request:(route,method='GET')=>originalFetch(base+route,{method}),upstream,setRows:(value,code=200)=>{rows=value;status=code;},downstream:()=>downstream});
  assert.equal(downstream,0);
 }finally{
  server.closeAllConnections();await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
  globalThis.fetch=originalFetch;
  for(const [key,value]of Object.entries(previous)){if(value===undefined)delete process.env[key];else process.env[key]=value;}
 }
}

test('Express mounts public runtime images before parsing, state hydration and authentication',()=>{
 const server=readFileSync('server.ts','utf8');
 assert.match(server,/import runtimeAssetHandler from '\.\/server\/vercel\/runtime-asset'/);
 const mounted=server.indexOf("app.all('/api/public/runtime-assets/:key',runtimeAssetHandler)");
 assert.ok(mounted>server.indexOf("app.get('/api/health'"));
 assert.ok(mounted<server.indexOf("app.use(express.json("));
 assert.ok(mounted<server.indexOf('const acquireRuntimeRequest=createRuntimeRequestQueue()'));
 assert.ok(mounted<server.indexOf("app.use('/api', attachPortalIdentity)"));
});

test('same handler serves exact PNG bytes through Express parameters and Vercel query keys without login',async()=>{
 const png=await sharp({create:{width:2,height:2,channels:4,background:{r:10,g:80,b:30,alpha:0.5}}}).png().toBuffer();
 await withAssetServer(async({request,upstream,setRows})=>{
  setRows([{mime_type:'image/png',data_url:'data:image/png;base64,'+png.toString('base64')}]);
  for(const route of [`/api/public/runtime-assets/${'B'.repeat(64)}?key=${'a'.repeat(64)}`,`/api/runtime-asset?key=${'b'.repeat(64)}`]){
   const response=await request(route);assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'image/png');
   assert.equal(response.headers.get('content-length'),String(png.length));assert.equal(response.headers.get('cache-control'),'public, max-age=31536000, immutable');
   assert.equal(response.headers.get('etag'),`"${'b'.repeat(64)}"`);assert.equal(response.headers.get('x-content-type-options'),'nosniff');
   assert.deepEqual(Buffer.from(await response.arrayBuffer()),png);
  }
  assert.equal(upstream.length,2);assert.ok(upstream.every(call=>call.method==='GET'&&call.url.includes(`asset_key=eq.${'b'.repeat(64)}`)));
 });
});

test('PNG variant converts legacy WebP through the same HTTP handler and preserves transparent pixels',async()=>{
 const pixels=Buffer.from([0,0,0,0,30,150,30,255,30,150,30,255,0,0,0,0]);
 const webp=await sharp(pixels,{raw:{width:2,height:2,channels:4}}).webp({lossless:true}).toBuffer();
 const original=Buffer.from(webp),expected=await sharp(webp,{limitInputPixels:16_000_000}).png().toBuffer();
 await withAssetServer(async({request,setRows})=>{
  setRows([{mime_type:'image/webp',data_url:'data:image/webp;base64,'+webp.toString('base64')}]);
  const response=await request(`/api/public/runtime-assets/${'a'.repeat(64)}?format=png`);
  assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'image/png');assert.equal(response.headers.get('etag'),`"${'a'.repeat(64)}-png"`);
  const bytes=Buffer.from(await response.arrayBuffer());assert.deepEqual(bytes,expected);
  const decoded=await sharp(bytes).raw().toBuffer({resolveWithObject:true});assert.equal(decoded.info.channels,4);assert.equal(decoded.data[3],0);assert.equal(decoded.data[7],255);
  assert.deepEqual(webp,original);
 });
});

test('invalid keys and unsupported methods do not query storage or authentication',async()=>{
 await withAssetServer(async({request,upstream})=>{
  for(const route of ['/api/public/runtime-assets/invalid?key='+'a'.repeat(64),'/api/runtime-asset','/api/runtime-asset?key=invalid']){
   const response=await request(route);assert.equal(response.status,404);assert.equal((await response.json()).error,'Ativo não localizado.');
  }
  for(const method of ['POST','DELETE','HEAD']){
   const response=await request('/api/public/runtime-assets/'+'a'.repeat(64),method);assert.equal(response.status,405);assert.equal(response.headers.get('allow'),'GET');
  }
  assert.equal(upstream.length,0);
 });
});

test('unconfigured storage fails with 503 before any provider or authentication lookup',async()=>{
 await withAssetServer(async({request,upstream})=>{
  for(const missing of ['url','secret']){
   process.env.SUPABASE_URL=missing==='url'?'':'https://runtime-asset-fixture.invalid';process.env.SUPABASE_SECRET_KEY=missing==='secret'?'':'sb_secret_' + 'runtime_asset_fixture';
   const response=await request('/api/public/runtime-assets/'+'a'.repeat(64));assert.equal(response.status,503);assert.match(response.headers.get('cache-control')||'',/no-store/);
   assert.equal((await response.json()).error,'Ativo temporariamente indisponível.');
  }
  assert.equal(upstream.length,0);
 });
});

test('missing images and unavailable storage keep their 404 and 502 responses without public caching',async t=>{
 t.mock.method(console,'error',()=>{});
 await withAssetServer(async({request,setRows,upstream})=>{
  const missing=await request('/api/public/runtime-assets/'+'a'.repeat(64));assert.equal(missing.status,404);assert.match(missing.headers.get('cache-control')||'',/no-store/);
  setRows([],500);
  const unavailable=await request('/api/public/runtime-assets/'+'a'.repeat(64));assert.equal(unavailable.status,502);assert.match(unavailable.headers.get('cache-control')||'',/no-store/);
  assert.equal((await unavailable.json()).error,'Ativo temporariamente indisponível.');assert.equal(upstream.length,2);
 });
});
