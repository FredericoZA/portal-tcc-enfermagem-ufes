import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalDriveOriginalLinks} from './driveOriginalLinks';
test('a persisted original opens through canonical Google URLs without provider credentials or I/O',t=>{
 t.mock.method(globalThis,'fetch',async()=>assert.fail('Opening a stored original must never request OAuth, ACL or PDF bytes'));
 assert.deepEqual(canonicalDriveOriginalLinks('persisted_original_123','a'.repeat(64)),{view:'https://drive.google.com/file/d/persisted_original_123/view',download:'https://drive.google.com/uc?export=download&id=persisted_original_123'});
 assert.equal(canonicalDriveOriginalLinks('issued_invitation_123')?.view,'https://drive.google.com/file/d/issued_invitation_123/view');
});
test('untrusted URLs, local fixture pointers and malformed recorded fingerprints never become Drive destinations',()=>{
 for(const id of ['https://evil.invalid/doc','https://drive.google.com/file/d/id/view','../another_file_123','stored_original_123?access_token=secret','local_review_fixture_123','short','a'.repeat(151)])assert.equal(canonicalDriveOriginalLinks(id,'a'.repeat(64)),null);
 for(const hash of ['','not-a-sha','b'.repeat(63)])assert.equal(canonicalDriveOriginalLinks('persisted_original_123',hash),null);
});
