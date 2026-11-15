import test from 'node:test';import assert from 'node:assert/strict';
import {createPublicRepositoryReader} from './publicRepositoryData';import {DEMO_PROCESSES} from '../src/services/demoSeed';import {buildPublicRepository} from './publicViews';
test('repository reader preserves public filtering and checks freshness without installing private runtime',async()=>{
 let revision=1,reads=0,fail=false;const snapshot={processes:structuredClone(DEMO_PROCESSES),legacyAcademicRecords:[]};
 const read=createPublicRepositoryReader({durable:()=>true,readRevision:async()=>{if(fail)throw Error('offline');return revision;},readDurable:async()=>{reads++;return {...snapshot,revision};},readLocal:()=>assert.fail('no stale local fallback')});
 assert.deepEqual(await read(),buildPublicRepository(snapshot.processes,[]));const data=await read();data[0].titulo='mutated';assert.notEqual((await read())[0].titulo,'mutated');assert.equal(reads,1);
 revision++;await read();assert.equal(reads,2);fail=true;await assert.rejects(read(),/offline/);
});
