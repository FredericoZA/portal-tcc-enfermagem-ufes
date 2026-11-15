import test from 'node:test';import assert from 'node:assert/strict';import {archiveRetiredRuntimeBackups} from './retention';
const row={backup_id:1,revision:4,reason:'maintenance',created_at:'2020-01-01',payload:{settings:{},processes:[]},payload_sha256:'a'.repeat(64)};
test('retention never removes the database backup when encrypted Drive readback fails',async()=>{
 let deleted=false;await assert.rejects(archiveRetiredRuntimeBackups('root',{list:async()=>[row],backup:async()=>{throw Error('readback failed');},finalize:async()=>{deleted=true;return true;}}));assert.equal(deleted,false);
});
test('retention preserves provenance and finalizes only after a complete restoration proof',async()=>{
 let proven=false;const result=await archiveRetiredRuntimeBackups('root',{list:async()=>[row],backup:async(snapshot:any)=>{assert.deepEqual(snapshot.retentionSource,{backupId:1,revision:4,reason:'maintenance',createdAt:'2020-01-01',payloadSha256:row.payload_sha256});proven=true;return {restorable:true,driveRoundTrip:true,checksumValid:true,backupFileId:'drive-file-id',encryptedSha256:'b'.repeat(64),sourceSha256:'c'.repeat(64)} as any;},finalize:async(input)=>{assert.equal(proven,true);assert.equal(input.payloadSha256,row.payload_sha256);return true;}});assert.equal(result.archived,1);
});
