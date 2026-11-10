import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {apiClient,ApiRequestError} from '../src/services/apiClient';

const source=readFileSync(new URL('../src/components/ConfigurableRegistration.tsx',import.meta.url),'utf8');
const effectBody=source.split('  useEffect(()=>{\n    setDirectory([]);')[1]?.split('  },[lookupField,lookupQuery,normalizedLookupValue,readOnly,preview,suspended]);')[0];
assert.ok(effectBody,'Exercise the actual field effect, not a copy of its logic.');
const runEffect=new Function('apiClient','setDirectory','lookupField','lookupQuery','normalizedLookupValue','readOnly','preview','suspended','setTimeout','clearTimeout','AbortController',`setDirectory([]);${effectBody}`);

function fieldEffect(options:{query?:string|null;value?:string;suspended?:boolean;readOnly?:boolean;preview?:boolean}={}){
  let timer:(()=>void)|undefined;
  const results:string[][]=[];
  const calls:Array<{signal:AbortSignal;resolve:(values:string[])=>void}>=[];
  const cleanup=runEffect({getRegistrationSuggestions:(_field:string,_query:string,options:{signal:AbortSignal})=>new Promise<string[]>(resolve=>calls.push({signal:options.signal,resolve}))},(values:string[])=>results.push(values),'nome',options.query??null,options.value??'ana silva',options.readOnly??false,options.preview??false,options.suspended??false,(callback:()=>void)=>{timer=callback;return 1;},()=>{timer=undefined;},AbortController) as (()=>void)|undefined;
  return {cleanup,calls,results,fire:()=>{const callback=timer;timer=undefined;callback?.();}};
}

test('restoring/remounting a filled name does not query the directory; typing does',()=>{
  const restored=fieldEffect();restored.fire();assert.equal(restored.calls.length,0);
  const typed=fieldEffect({query:'ana silva'});typed.fire();assert.equal(typed.calls.length,1);typed.cleanup?.();
  for(const options of [{query:'an',value:'an'},{query:'ana silva',readOnly:true},{query:'ana silva',preview:true},{query:'ana silva',suspended:true},{query:'ana antiga',value:'ana nova'}]){
    const field=fieldEffect(options);field.fire();assert.equal(field.calls.length,0);
  }
});

test('typing again, leaving a field or starting save cancels the timer and active request; late results stay ignored',async()=>{
  const pending=fieldEffect({query:'ana silva'});pending.cleanup?.();pending.fire();assert.equal(pending.calls.length,0);
  const active=fieldEffect({query:'ana silva'});active.fire();assert.equal(active.calls[0].signal.aborted,false);
  active.cleanup?.();assert.equal(active.calls[0].signal.aborted,true);
  active.calls[0].resolve(['stale name']);await Promise.resolve();await Promise.resolve();
  assert.deepEqual(active.results,[[]]);
  const suspended=fieldEffect({query:'ana silva',suspended:true});suspended.fire();assert.equal(suspended.calls.length,0);
});

test('caller-owned suggestion cancellation does not abort another caller or bypass authorization',async t=>{
  const signals:AbortSignal[]=[];
  t.mock.method(globalThis,'fetch',async(_url:unknown,options:RequestInit)=>{
    signals.push(options.signal!);assert.equal(options.credentials,'include');
    if(signals.length===1)return new Promise<Response>(()=>{});
    return Response.json({error:'Acesso não autorizado.'},{status:403});
  });
  const first=new AbortController(),second=new AbortController();
  const canceled=apiClient.getRegistrationSuggestions('nome','Ana Silva',{signal:first.signal});
  const denied=apiClient.getRegistrationSuggestions('nome','Ana Silva',{signal:second.signal});
  const checkCanceled=assert.rejects(canceled,error=>error instanceof ApiRequestError&&error.code==='REQUEST_CANCELED');
  const checkDenied=assert.rejects(denied,error=>error instanceof ApiRequestError&&error.status===403);
  first.abort();await Promise.all([checkCanceled,checkDenied]);
  assert.equal(signals.length,2);assert.equal(signals[0].aborted,true);assert.equal(signals[1].aborted,false);
});
