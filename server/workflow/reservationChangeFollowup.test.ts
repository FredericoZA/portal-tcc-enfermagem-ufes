import test from 'node:test';import assert from 'node:assert/strict';import{EventEmitter}from'node:events';
import{afterReservationChangeResponse}from'./reservationChangeFollowup';
import{attachRuntimeRequestLifecycle,beginRuntimeRequestTask}from'../runtimeRequestQueue';
import{savedReservationMatches}from'../../src/utils/reservationChangeConfirmation';
import{DEMO_PROCESSES}from'../../src/services/demoSeed';

test('reservation acknowledgement precedes provider execution while the runtime lease protects the followup',async()=>{
 const request={},response=new EventEmitter();let released=0,executed=0;let complete!:()=>void;
 const gate=new Promise<void>(resolve=>{complete=resolve;});const lifecycle=attachRuntimeRequestLifecycle(request,()=>{released++;});lifecycle.hydrationFinished();
 const registered:Promise<void>[]=[];
 const task=afterReservationChangeResponse(request,response,async()=>{executed++;await gate;},{retain:beginRuntimeRequestTask,waitUntil:task=>registered.push(task),onError:()=>assert.fail('Unexpected failure')});
 assert.equal(executed,0);assert.equal(registered[0],task);response.emit('finish');lifecycle.responseFinished();await Promise.resolve();assert.equal(executed,1);assert.equal(released,0);
 response.emit('close');assert.equal(executed,1);complete();await task;assert.equal(released,1);
});
test('provider failure after acknowledgement is reported without replay or a second response',async()=>{
 const response=new EventEmitter();let runs=0,errors=0,releases=0;
 const task=afterReservationChangeResponse({},response,async()=>{runs++;throw Error('Provider unavailable');},{retain:()=>()=>{releases++;},onError:()=>{errors++;}});
 response.emit('finish');await task;response.emit('close');await Promise.resolve();assert.deepEqual({runs,errors,releases},{runs:1,errors:1,releases:1});
});
test('lost-response reconciliation requires a newer reservation and the exact requested date, time and location',()=>{
 const before=structuredClone(DEMO_PROCESSES[0]);before.dataRevision=6;before.defesa.reservationRevision=2;
 const proposal={date:'2030-11-20',time:'14:00',locationChoice:'__OUTRO_LOCAL__',customLocation:'Sala alternativa',expectedDataRevision:6};
 const latest=structuredClone(before);latest.dataRevision=7;latest.defesa.reservationRevision=3;latest.defesa.startAt='2030-11-20T17:00:00Z';latest.defesa.local='Sala Alternativa';
 assert.equal(savedReservationMatches(latest,before,proposal),true);
 for(const patch of [{id:'another'},{dataRevision:6},{defesa:{...latest.defesa,reservationRevision:2}},{defesa:{...latest.defesa,startAt:'2030-11-21T17:00:00Z'}},{defesa:{...latest.defesa,local:'Outra sala'}}])assert.equal(savedReservationMatches({...latest,...patch},before,proposal),false);
});
