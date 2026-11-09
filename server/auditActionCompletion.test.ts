import test from 'node:test';
import assert from 'node:assert/strict';
import {finishAuditAction} from '../src/utils/auditActionCompletion';

test('refresh failure preserves a confirmed result, unlocks both flags, and never repeats the operation',async()=>{
 let requests=0,refreshes=0,working=true,inProgress=true;
 let message='';
 const request=async()=>{requests++;return 'Limpeza concluída.';};
 message=await request();
 await finishAuditAction({
  refresh:async()=>{refreshes++;throw Error('Readback temporarily unavailable');},
  warn:warning=>{message=[message,warning].filter(Boolean).join(' ');},
  release:()=>{working=false;inProgress=false;},
 });
 assert.equal(requests,1);assert.equal(refreshes,1);
 assert.equal(working,false);assert.equal(inProgress,false);
 assert.match(message,/^Limpeza concluída\./);
 assert.match(message,/Não foi possível atualizar/);
 assert.doesNotMatch(message,/Readback temporarily/,'technical readback errors must not replace the result');
});

test('refresh failure also preserves an uncertain operation error while releasing the action',async()=>{
 let requests=0,working=true,inProgress=true,message='';
 try{requests++;throw Error('A retomada não foi confirmada.');}
 catch(error){message=(error as Error).message;}
 await finishAuditAction({refresh:async()=>{throw Error('offline');},warn:warning=>{message+=' '+warning;},release:()=>{working=false;inProgress=false;}});
 assert.equal(requests,1);assert.equal(working,false);assert.equal(inProgress,false);
 assert.match(message,/^A retomada não foi confirmada\./);assert.match(message,/resultado da ação foi mantido/);
});

test('successful refresh or cancelled action does not append a failure warning',async()=>{
 for(const refresh of [undefined,async()=>undefined]){
  let releases=0,warnings=0;
  await finishAuditAction({refresh,warn:()=>{warnings++;},release:()=>{releases++;}});
  assert.equal(releases,1);assert.equal(warnings,0);
 }
});
