import test from 'node:test';
import assert from 'node:assert/strict';
import {createRuntimeRequestQueue,RuntimeRequestAdmissionError,settlePreviousRuntimeWrites} from './runtimeRequestQueue';

function fakeClock(){
  let now=0,nextId=0;
  const tasks=new Map<number,{at:number;callback:()=>void}>();
  return{
    now:()=>now,
    schedule:(callback:()=>void,delay:number)=>{const id=++nextId;tasks.set(id,{at:now+delay,callback});return id;},
    cancel:(id:unknown)=>{tasks.delete(Number(id));},
    advance:(milliseconds:number,runTimers=true)=>{now+=milliseconds;if(runTimers)for(const[id,task]of [...tasks])if(task.at<=now){tasks.delete(id);task.callback();}},
    timerCount:()=>tasks.size,
  };
}

test('runtime mantém exclusão entre envio e recarga concorrente, mesmo com liberação duplicada',async()=>{
  const acquire=createRuntimeRequestQueue();
  const releaseFirst=await acquire();
  let secondEntered=false,thirdEntered=false;
  const second=acquire().then(release=>{secondEntered=true;return release;});
  const third=acquire().then(release=>{thirdEntered=true;return release;});
  await Promise.resolve();assert.equal(secondEntered,false);assert.equal(thirdEntered,false);
  releaseFirst();const releaseSecond=await second;
  assert.equal(secondEntered,true);assert.equal(thirdEntered,false);
  releaseFirst();await Promise.resolve();assert.equal(thirdEntered,false);
  releaseSecond();const releaseThird=await third;
  assert.equal(thirdEntered,true);releaseThird();
  const releaseNext=await acquire();releaseNext();
});


test('falha de commit anterior não impede uma recarga autoritativa; a falha original continua visível',async()=>{
  const failed=Promise.reject(new Error('CAS conflict'));
  const settled=settlePreviousRuntimeWrites(failed);
  await assert.rejects(failed,/CAS conflict/);
  await assert.doesNotReject(settled);
  let freshRead=false;
  await settled.then(()=>{freshRead=true;});
  assert.equal(freshRead,true);
  await assert.rejects(settled.then(()=>Promise.reject(new Error('database unavailable'))),/database unavailable/);
});

test('admissão padrão aceita um dono e 32 esperas, recusa excedente com 503 e mantém ordem',async()=>{
  const clock=fakeClock();
  const acquire=createRuntimeRequestQueue(clock);
  const releaseFirst=await acquire();
  const entered:number[]=[];
  const pending=Array.from({length:32},(_,index)=>acquire().then(release=>{entered.push(index);return release;}));
  await assert.rejects(acquire(),error=>error instanceof RuntimeRequestAdmissionError&&error.code==='RUNTIME_REQUEST_QUEUE_FULL'&&error.status===503&&error.retryAfterSeconds===5);
  assert.equal(clock.timerCount(),32);
  assert.deepEqual(entered,[]);
  releaseFirst();
  for(let index=0;index<pending.length;index++){
    const release=await pending[index];
    assert.equal(entered.at(-1),index);
    assert.equal(entered.length,index+1);
    release();
    release();
  }
  assert.equal(clock.timerCount(),0);
  (await acquire())();
});

test('timeout de cinco segundos remove espera e libera capacidade, sem liberar o dono ativo',async()=>{
  const clock=fakeClock();
  const acquire=createRuntimeRequestQueue({...clock,maxWaiting:1});
  const releaseFirst=await acquire();
  const expired=acquire();
  const rejection=assert.rejects(expired,error=>error instanceof RuntimeRequestAdmissionError&&error.code==='RUNTIME_REQUEST_QUEUE_TIMEOUT');
  clock.advance(4_999);
  assert.equal(clock.timerCount(),1);
  clock.advance(1);
  await rejection;
  assert.equal(clock.timerCount(),0);
  let nextEntered=false;
  const next=acquire().then(release=>{nextEntered=true;return release;});
  await Promise.resolve();
  assert.equal(nextEntered,false);
  releaseFirst();
  (await next)();
});

test('prazo vencido é recusado mesmo se o timer ainda não executou',async()=>{
  const clock=fakeClock();
  const acquire=createRuntimeRequestQueue(clock);
  const releaseFirst=await acquire();
  const expired=acquire();
  const rejection=assert.rejects(expired,error=>error instanceof RuntimeRequestAdmissionError&&error.code==='RUNTIME_REQUEST_QUEUE_TIMEOUT');
  clock.advance(5_001,false);
  releaseFirst();
  await rejection;
  assert.equal(clock.timerCount(),0);
  (await acquire())();
});

test('cancelar uma espera remove seus recursos e não deixa pedidos posteriores ultrapassarem o dono',async()=>{
  const clock=fakeClock();
  const acquire=createRuntimeRequestQueue({...clock,maxWaiting:2});
  const releaseFirst=await acquire();
  const controller=new AbortController();
  const canceled=acquire(controller.signal);
  const canceledRejection=assert.rejects(canceled,error=>error instanceof RuntimeRequestAdmissionError&&error.code==='RUNTIME_REQUEST_CANCELED');
  let secondEntered=false,thirdEntered=false;
  const second=acquire().then(release=>{secondEntered=true;return release;});
  controller.abort();
  await canceledRejection;
  const third=acquire().then(release=>{thirdEntered=true;return release;});
  assert.equal(clock.timerCount(),2);
  await Promise.resolve();
  assert.equal(secondEntered,false);
  assert.equal(thirdEntered,false);
  releaseFirst();
  const releaseSecond=await second;
  assert.equal(secondEntered,true);
  assert.equal(thirdEntered,false);
  releaseSecond();
  (await third)();
  assert.equal(clock.timerCount(),0);
});

test('abort anterior não reserva posição e abort depois da concessão não libera lease ativa',async()=>{
  const clock=fakeClock();
  const acquire=createRuntimeRequestQueue(clock);
  const before=new AbortController();before.abort();
  await assert.rejects(acquire(before.signal),error=>error instanceof RuntimeRequestAdmissionError&&error.code==='RUNTIME_REQUEST_CANCELED');
  const active=new AbortController();
  const releaseFirst=await acquire(active.signal);
  let secondEntered=false;
  const second=acquire().then(release=>{secondEntered=true;return release;});
  active.abort();
  await Promise.resolve();
  assert.equal(secondEntered,false);
  releaseFirst();
  const releaseSecond=await second;
  let thirdEntered=false;
  const third=acquire().then(release=>{thirdEntered=true;return release;});
  releaseFirst();
  await Promise.resolve();
  assert.equal(thirdEntered,false);
  releaseSecond();
  (await third)();
});

test('cancelamento depois do handoff de uma espera não invalida o novo dono nem o próximo pedido',async()=>{
  const clock=fakeClock();
  const acquire=createRuntimeRequestQueue(clock);
  const releaseFirst=await acquire();
  const controller=new AbortController();
  const second=acquire(controller.signal);
  releaseFirst();
  controller.abort();
  const releaseSecond=await second;
  let entered=false;
  const third=acquire().then(release=>{entered=true;return release;});
  await Promise.resolve();
  assert.equal(entered,false);
  releaseSecond();
  (await third)();
  assert.equal(clock.timerCount(),0);
});
