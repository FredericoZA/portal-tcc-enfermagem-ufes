import test from 'node:test';import assert from 'node:assert/strict';
import {mergeOperationalMetadata} from './operationalMetadata';
const ids=new Set(['p']);const terminal=new Set(['ARCHIVED','CANCELED']);
test('backup antigo não apaga assinaturas e estado atual prevalece sobre cópia antiga',()=>{
 const current=[{id:'sig',processId:'p',status:'ARCHIVED',sha256:'original'}];
 assert.deepEqual(mergeOperationalMetadata(current,undefined,ids,terminal),current);
 assert.deepEqual(mergeOperationalMetadata(current,[{id:'sig',processId:'p',status:'SENT'}],ids,terminal),current);
 assert.equal(mergeOperationalMetadata(current,[{id:'old',processId:'p',status:'ARCHIVED'}],ids,terminal).length,2);
});
test('restore recusa replay de operação pendente e perda de processo com evidência',()=>{
 assert.throws(()=>mergeOperationalMetadata([],[{id:'new',processId:'p',status:'SENDING'}],ids,terminal),/pendentes/);
 assert.throws(()=>mergeOperationalMetadata([{id:'sig',processId:'removed',status:'ARCHIVED'}],undefined,ids,terminal),/removeria/);
 assert.throws(()=>mergeOperationalMetadata([],[{id:'sig',status:'ARCHIVED'},{id:'sig',status:'ARCHIVED'}],ids,terminal),/duplicados/);
});
