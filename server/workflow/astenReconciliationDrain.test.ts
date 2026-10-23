import test from 'node:test';
import assert from 'node:assert/strict';
import type {AstenWebhookEvent} from '../../src/types/automation';
import {isReconcileableAstenWebhookEvent} from '../integrations/astenEventLedger';
import {drainAstenReconciliation} from './astenReconciliationDrain';

const start=Date.parse('2026-10-15T12:00:00.000Z');
function fixture(id:number):AstenWebhookEvent {
  return {id:`event-${id}`,fingerprint:`fp-${String(id).padStart(3,'0')}`,envelopeId:String(id),matchedJobId:`job-${id}`,status:'SIGNED',receivedAt:new Date(start+id).toISOString(),duplicate:false,safePayload:{}};
}

test('drena até 100 retornos por invocação e mantém o restante como pendente',async()=>{
  const events=Array.from({length:130},(_,index)=>fixture(index));
  const seen:string[]=[];
  const result=await drainAstenReconciliation({
    events:()=>events,eligible:isReconcileableAstenWebhookEvent,limit:500,timeBudgetMs:180_000,now:()=>start,
    claim:async(event)=>{seen.push(event.id);},
    reconcile:async(event)=>{event.processedAt=new Date(start).toISOString();return 'confirmed';}
  });
  assert.deepEqual(result,{checked:100,confirmed:100,pending:30,deferred:0,failed:0,stopped:'limit'});
  assert.equal(seen.length,100);
  assert.equal(new Set(seen).size,100);
});

test('para no orçamento de tempo entre eventos, depois do commit da operação iniciada',async()=>{
  const events=[fixture(1),fixture(2),fixture(3),fixture(4)];
  let clock=start;
  const claimed:string[]=[];
  const result=await drainAstenReconciliation({
    events:()=>events,eligible:isReconcileableAstenWebhookEvent,limit:100,timeBudgetMs:180_000,now:()=>clock,
    claim:async(event)=>{claimed.push(event.id);},
    reconcile:async(event)=>{clock+=60_000;event.processedAt=new Date(clock).toISOString();return 'confirmed';}
  });
  assert.deepEqual(claimed,['event-1','event-2','event-3']);
  assert.equal(result.checked,3);
  assert.equal(result.pending,1);
  assert.equal(result.stopped,'time_budget');
});

test('falha da barreira CAS interrompe o lote antes de consultar qualquer provedor',async()=>{
  const events=[fixture(1),fixture(2)];
  let claims=0;
  let providerCalls=0;
  const result=await drainAstenReconciliation({
    events:()=>events,eligible:isReconcileableAstenWebhookEvent,limit:100,timeBudgetMs:180_000,now:()=>start,
    claim:async()=>{claims++;throw new Error('conflito de revisão');},
    reconcile:async()=>{providerCalls++;return 'confirmed';}
  });
  assert.equal(claims,1);
  assert.equal(providerCalls,0);
  assert.equal(result.checked,0);
  assert.equal(result.failed,1);
  assert.equal(result.pending,2);
  assert.equal(result.stopped,'persistence');
});

test('lease e backoff na frente da fila não escondem assinaturas posteriores prontas',async()=>{
  const events=[fixture(1),fixture(2),fixture(3),fixture(4),fixture(5),fixture(6)];
  events[0].retryAfter=new Date(start+60_000).toISOString();
  events[1].processingLeaseUntil=new Date(start+60_000).toISOString();
  events[2].matchedJobId=undefined;
  events[3].processedAt=new Date(start-1).toISOString();
  events[4].safePayload.processedAt=new Date(start-1).toISOString();
  const seen:string[]=[];
  const result=await drainAstenReconciliation({
    events:()=>events,eligible:isReconcileableAstenWebhookEvent,limit:3,timeBudgetMs:45_000,now:()=>start,
    claim:async(event)=>{seen.push(event.id);},
    reconcile:async(event)=>{event.processedAt=new Date(start).toISOString();return 'confirmed';}
  });
  assert.deepEqual(seen,['event-6']);
  assert.equal(result.confirmed,1);
  assert.equal(result.pending,3);
  assert.equal(result.deferred,3);
  assert.equal(result.stopped,'empty');
});

test('um evento com erro é tentado só uma vez e não impede o próximo callback',async()=>{
  const events=[fixture(1),fixture(2)];
  const seen:string[]=[];
  const result=await drainAstenReconciliation({
    events:()=>events,eligible:isReconcileableAstenWebhookEvent,limit:100,timeBudgetMs:180_000,now:()=>start,
    claim:async(event)=>{seen.push(event.id);},
    reconcile:async(event)=>{
      if(event.id==='event-1'){event.retryAfter=new Date(start+60_000).toISOString();return 'failed';}
      event.processedAt=new Date(start).toISOString();return 'confirmed';
    }
  });
  assert.deepEqual(seen,['event-1','event-2']);
  assert.equal(result.checked,2);
  assert.equal(result.failed,1);
  assert.equal(result.confirmed,1);
  assert.equal(result.pending,1);
  assert.equal(result.deferred,1);
});

test('falha no commit final interrompe o lote sem reivindicar o próximo evento',async()=>{
  const events=[fixture(1),fixture(2)];
  const claimed:string[]=[];
  const result=await drainAstenReconciliation({
    events:()=>events,eligible:isReconcileableAstenWebhookEvent,limit:100,timeBudgetMs:180_000,now:()=>start,
    claim:async(event)=>{claimed.push(event.id);},
    reconcile:async()=> 'stop'
  });
  assert.deepEqual(claimed,['event-1']);
  assert.equal(result.failed,1);
  assert.equal(result.checked,1);
  assert.equal(result.pending,2);
  assert.equal(result.stopped,'persistence');
});

test('orçamento já esgotado não reivindica eventos nem acessa rede',async()=>{
  let claims=0;
  const result=await drainAstenReconciliation({
    events:()=>[fixture(1)],eligible:isReconcileableAstenWebhookEvent,limit:3,timeBudgetMs:0,now:()=>start,
    claim:async()=>{claims++;},reconcile:async()=>{throw new Error('não deve executar');}
  });
  assert.equal(claims,0);
  assert.equal(result.checked,0);
  assert.equal(result.pending,1);
  assert.equal(result.stopped,'time_budget');
});
