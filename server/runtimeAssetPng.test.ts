import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import handler from '../api/runtime-asset';

test('PNG mail variant preserves alpha on a legacy WebP logo without altering the stored asset',async()=>{
 const oldFetch=globalThis.fetch,oldUrl=process.env.SUPABASE_URL,oldKey=process.env.SUPABASE_SECRET_KEY;
 try{
  process.env.SUPABASE_URL='https://database.example';process.env.SUPABASE_SECRET_KEY='sb_secret_fixture';
  const pixels=Buffer.from([0,0,0,0,30,150,30,255,30,150,30,255,0,0,0,0]);
  const webp=await sharp(pixels,{raw:{width:2,height:2,channels:4}}).webp({lossless:true}).toBuffer();
  globalThis.fetch=async()=>new Response(JSON.stringify([{mime_type:'image/webp',data_url:'data:image/webp;base64,'+webp.toString('base64')}]));
  for(const png of [true,false]){
   const headers=new Map<string,string>();let code=0,body=Buffer.alloc(0);
   const response={setHeader:(key:string,value:string)=>headers.set(key,value),status:(value:number)=>{code=value;return response;},send:(value:Buffer)=>{body=value;return response;},json:()=>{throw Error('Unexpected asset error');}};
   await handler({method:'GET',query:{key:'a'.repeat(64),...(png?{format:'png'}:{})}} as any,response as any);
   assert.equal(code,200);assert.equal(headers.get('Content-Type'),png?'image/png':'image/webp');
   if(png){const decoded=await sharp(body).raw().toBuffer({resolveWithObject:true});assert.equal(decoded.info.channels,4);assert.equal(decoded.data[3],0);assert.equal(decoded.data[7],255);assert.match(headers.get('ETag')!,/-png/);}
   else assert.deepEqual(body,webp);
  }
 }finally{globalThis.fetch=oldFetch;if(oldUrl===undefined)delete process.env.SUPABASE_URL;else process.env.SUPABASE_URL=oldUrl;if(oldKey===undefined)delete process.env.SUPABASE_SECRET_KEY;else process.env.SUPABASE_SECRET_KEY=oldKey;}
});
