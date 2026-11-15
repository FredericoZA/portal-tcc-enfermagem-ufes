import test from 'node:test';
import assert from 'node:assert/strict';
import {canReadPagedAudit} from './auditPageRead';
test('only standard read-only audit pages use the bounded database projection',()=>{
 assert.equal(canReadPagedAudit('GET','/admin/audit-logs',{paginated:'true'}),true);
 assert.equal(canReadPagedAudit('GET','/admin/audit-logs',{paginated:'true',processId:'p',before:'cursor',kind:'all'}),true);
 for(const key of ['q','search','start','end','focusId','kind'])assert.equal(canReadPagedAudit('GET','/admin/audit-logs',{paginated:'true',[key]:'filter'}),false);
 assert.equal(canReadPagedAudit('GET','/admin/audit-logs',{}),false);
 assert.equal(canReadPagedAudit('POST','/admin/audit-logs',{paginated:'true'}),false);
});
