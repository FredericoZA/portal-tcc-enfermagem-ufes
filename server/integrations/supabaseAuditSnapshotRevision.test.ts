import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {currentPortalRuntimeRevision,loadPortalRuntimeState,loadPortalRuntimeLeanState,portalRuntimeSnapshotRevision,readCriticalAuditPage,refreshPortalRuntimeLeanState} from './supabase';

test('audit uses the exact hydrated projection revision across external commits without changing the CAS baseline',async t=>{
  for(const [key,value] of Object.entries({PORTAL_PERSISTENCE_PROVIDER:'supabase',SUPABASE_URL:'https://audit-snapshot.invalid',SUPABASE_SECRET_KEY:'fixture',PORTAL_RUNTIME_WIRE_SNAPSHOT:'false',PORTAL_RUNTIME_AUDIT_DELTA:'false',PORTAL_RUNTIME_CONDITIONAL_READS:'true'})){
    const previous=process.env[key];process.env[key]=value;t.after(()=>{if(previous===undefined)delete process.env[key];else process.env[key]=previous;});
  }
  let revision=7,missingProjection=false;
  const full={settings:{masterEmail:'master@example.invalid'},processes:[],auditLogs:[],legacyAcademicRecords:[]};
  const {auditLogs:_audit,legacyAcademicRecords:_legacy,...lean}=full;
  const fingerprint='a'.repeat(64);
  const auditReads:number[]=[];
  t.mock.method(globalThis,'fetch',async(input:any,init:any)=>{
    const url=new URL(input);
    if(url.pathname.endsWith('/portal_read_runtime_projection_v1')){
      if(missingProjection)return Response.json({code:'PGRST202'},{status:404});
      const request=JSON.parse(init.body);
      return Response.json([{revision,fingerprint,payload:request.known_fingerprint===fingerprint?null:lean}]);
    }
    if(url.pathname.endsWith('/portal_read_runtime_lean_v1'))return Response.json({code:'PGRST202'},{status:404});
    if(url.pathname.endsWith('/portal_read_runtime_lite_v1'))return Response.json([{revision,payload:{...lean,legacyAcademicRecords:[]}}]);
    if(url.pathname.endsWith('/portal_read_critical_audit_page_v1')){
      const requested=JSON.parse(init.body).expected_revision;auditReads.push(requested);
      if(requested!==revision)return Response.json({code:'40001'},{status:409});
      return Response.json({revision,total:0,logs:[],deliveries:[]});
    }
    assert.equal(url.pathname,'/rest/v1/portal_runtime_state');
    return Response.json([{revision,...(url.searchParams.get('select')==='payload,revision'?{payload:full}:{})}]);
  });
  const canonical=await loadPortalRuntimeState();
  assert.equal(portalRuntimeSnapshotRevision(canonical),7);
  assert.equal(currentPortalRuntimeRevision(),7);
  revision=8; // Another worker committed after this worker loaded its write baseline.
  const first=await loadPortalRuntimeLeanState();
  assert.equal(portalRuntimeSnapshotRevision(first),8);
  await readCriticalAuditPage({revision:portalRuntimeSnapshotRevision(first)!});
  revision=9; // Audit-only change: same projection hash, newer revision, payload omitted.
  const second=await refreshPortalRuntimeLeanState();
  assert.equal(portalRuntimeSnapshotRevision(second),9);
  assert.equal(portalRuntimeSnapshotRevision(first),8,'a later read must not relabel an earlier snapshot');
  await readCriticalAuditPage({revision:portalRuntimeSnapshotRevision(second)!});
  const cached=await refreshPortalRuntimeLeanState();
  assert.equal(portalRuntimeSnapshotRevision(cached),9,'unchanged-revision cache hit keeps the verified revision');
  revision=10;missingProjection=true;
  const fallback=await loadPortalRuntimeLeanState();
  assert.equal(portalRuntimeSnapshotRevision(fallback),10,'the LITE fallback binds its own revision, not a stale LEAN cache');
  await readCriticalAuditPage({revision:portalRuntimeSnapshotRevision(fallback)!});
  assert.deepEqual(auditReads,[8,9,10]);
  assert.equal(currentPortalRuntimeRevision(),7,'read-only projections never advance the canonical CAS write baseline');
  assert.equal(portalRuntimeSnapshotRevision({}),null);
  assert.equal(portalRuntimeSnapshotRevision(null),null);
});

test('audit handler receives the revision captured from its request hydration',async()=>{
  const source=await readFile('server.ts','utf8');
  assert.match(source,/res\.locals\.portalRuntimeReadRevision=portalRuntimeSnapshotRevision\(remote\)/);
  const handler=source.slice(source.indexOf("app.get('/api/admin/audit-logs'"),source.indexOf('// GET /api/admin/correction-requests'));
  assert.match(handler,/const revision=res\.locals\.portalRuntimeReadRevision/);
  assert.doesNotMatch(handler,/currentPortalRuntimeRevision\(\)/);
});
