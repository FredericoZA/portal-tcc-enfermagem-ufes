import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';

test('cold-start transient failure communicates the remaining shared recovery wait without weakening configuration errors',()=>{
 const source=readFileSync('server/vercel/index.ts','utf8');
 const start=source.indexOf('function unavailable('),end=source.indexOf('\nexport default',start);
 const code=ts.transpileModule('('+source.slice(start,end).trim()+')',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
 const now=100000;
 for(const retryStartupAt of [now+10000,now+1001,now,0]){
  const headers=new Map<string,string>();let status=0;let body:any;
  const response:any={setHeader:(k:string,v:string)=>headers.set(k,v),status:(n:number)=>{status=n;return response;},json:(v:unknown)=>{body=v;return response;}};
  const reply=runInNewContext(code,{retryStartupAt,Date:{now:()=>now},deployedCommit:()=> 'verified-commit'});
  reply(response,{code:'SUPABASE_CONNECTION_UNAVAILABLE',message:'Connection unavailable'});
  assert.equal(status,503);assert.equal(body.code,'SUPABASE_CONNECTION_UNAVAILABLE');assert.equal(body.commit,'verified-commit');
  assert.equal(headers.get('Cache-Control'),'no-store');
  assert.equal(headers.get('Retry-After'),retryStartupAt>now?String(Math.ceil((retryStartupAt-now)/1000)):undefined);
 }
 assert.match(source,/code: classifyStartupFailure\(error, stage\)\.code/,'safe diagnostic code distinguishes wrapped state errors without printing their payload');
});
