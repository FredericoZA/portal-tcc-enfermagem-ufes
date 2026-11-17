import test from 'node:test';import assert from 'node:assert/strict';
import {createPublicRepositoryReader} from './publicRepositoryData';import {DEMO_PROCESSES} from '../src/services/demoSeed';import {buildPublicRepository} from './publicViews';
test('repository reader preserves public filtering and checks freshness without installing private runtime',async()=>{
 let revision=1,reads=0,fail=false;const snapshot={processes:structuredClone(DEMO_PROCESSES),legacyAcademicRecords:[]};
 const read=createPublicRepositoryReader({durable:()=>true,readRevision:async()=>{if(fail)throw Error('offline');return revision;},readDurable:async()=>{reads++;return {...snapshot,revision};},readLocal:()=>assert.fail('no stale local fallback')});
 assert.deepEqual(await read(),buildPublicRepository(snapshot.processes,[]));const data=await read();data[0].titulo='mutated';assert.notEqual((await read())[0].titulo,'mutated');assert.equal(reads,1);
 revision++;await read();assert.equal(reads,2);fail=true;await assert.rejects(read(),/offline/);
});

test('repository read preserves historical consent normalization and protocol compatibility',async()=>{
 const legacy:any={id:'legado-0001',protocolo:'Legado 001',sourceFingerprint:'a'.repeat(64),titulo:'Historical work',autores:['Author'],orientador:'Advisor',coorientador:'',coorientadorInstituicao:'',examinadores:[],resumo:'Abstract',palavrasChave:['Care'],dataDefesa:'2023-06-01',horaDefesa:'14:00:00',localDefesa:'Room',isPublic:false,publishFullWork:false,publishExpandedAbstract:false,publicationState:'NOT_REQUESTED',authorizationDecision:'UNSPECIFIED',attachments:[{driveFileId:'private_file_123',fileName:'work.pdf',kind:'TRABALHO_COMPLETO',sha256:'',evidence:'SHA256:'+ 'b'.repeat(64)}],provenance:{publicationImportBaseline:{publicFiles:[{kind:'TRABALHO_COMPLETO',sha256:'b'.repeat(64)}]},originalConsent:['Sim']}};
 const {canonicalLegacyRecord}=await import('./legacyArchive');
 for(const durable of [false,true]){
 const read=createPublicRepositoryReader({durable:()=>durable,readRevision:async()=>1,readDurable:async()=>({processes:[],legacyAcademicRecords:[legacy],revision:1}),readLocal:()=>({processes:[],legacyAcademicRecords:[legacy]})});
 const actual=await read();assert.deepEqual(actual,buildPublicRepository([],[canonicalLegacyRecord(legacy)]));assert.equal(actual[0].protocolo,'001 - Legado');assert.equal(actual[0].acervo.publishFullWork,true);
 }
});
