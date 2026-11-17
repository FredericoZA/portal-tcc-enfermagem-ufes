import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import test,{type TestContext} from 'node:test';
import {PGlite} from '@electric-sql/pglite';
import {currentPortalRuntimeRevision,loadPortalRepositorySnapshot,portalRuntimeSnapshotRevision,readCachedPortalRuntimeState,refreshPortalSignatureState} from './supabase';

const migration='supabase/migrations/20261117030854_conditional_signature_and_repository_reads.sql';
const signatureRpc='/rest/v1/rpc/portal_read_signature_projection_v1';
const repositoryRpc='/rest/v1/rpc/portal_read_repository_projection_v1';
const keys=['settings','processes','memberships','authorizedStudents','removedAccessProcessKeys','revokedSessionIds','signatureJobs'];
const size=(value:unknown)=>Buffer.byteLength(JSON.stringify(value));
const fingerprint=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
function configure(t:TestContext,origin:string){
 for(const[key,value]of Object.entries({SUPABASE_URL:origin,SUPABASE_SECRET_KEY:'local-fixture',PORTAL_PERSISTENCE_PROVIDER:'supabase',PORTAL_RUNTIME_CONDITIONAL_READS:'true'})){
  const previous=process.env[key];process.env[key]=value;t.after(()=>{if(previous===undefined)delete process.env[key];else process.env[key]=previous;});
 }
}
const fixture=()=>({settings:{masterEmail:'master@example.invalid',sessionValidAfter:0},processes:[{id:'one',titulo:'Fixture',privateAnswers:'preserved'}],memberships:[{processId:'one',email:'author@example.invalid',active:true,roles:['STUDENT']}],authorizedStudents:[{email:'author@example.invalid',active:true}],removedAccessProcessKeys:[] as string[],revokedSessionIds:[] as string[],signatureJobs:[{id:'job',processId:'one',status:'SENT'}],
 emailDeliveries:[{id:'email',html:'e'.repeat(100_000)}],workflowRuns:[{id:'workflow',data:'w'.repeat(30_000)}],studioVersions:[{snapshot:'s'.repeat(30_000)}],auditLogs:[{id:'audit',evidence:'a'.repeat(100_000)}],legacyAcademicRecords:[{id:'legacy',provenance:{privateSource:'l'.repeat(100_000)}}]});
const project=(state:ReturnType<typeof fixture>)=>Object.fromEntries(keys.map(key=>[key,state[key as keyof typeof state]]));

test('SQL signature/catalog projections retain current ACL and consent, omit unchanged payloads and deny public roles',async()=>{
 const db=new PGlite();try{
  await db.exec('create role anon;create role authenticated;create role service_role bypassrls;create table public.portal_runtime_state(id text primary key,revision bigint,payload jsonb);alter table public.portal_runtime_state enable row level security;alter table public.portal_runtime_state force row level security;revoke all on public.portal_runtime_state from public,anon,authenticated;grant select on public.portal_runtime_state to service_role;');
  const original=fixture();await db.query("insert into public.portal_runtime_state values('global',7,$1)",[JSON.stringify(original)]);
  await db.exec(await readFile('supabase/migrations/20261117023313_repository_body_row_link_projection.sql','utf8'));
  await db.exec(await readFile(migration,'utf8'));
  const read=(kind:'signature'|'repository',hash:string|null=null)=>db.query<any>(`select * from public.portal_read_${kind}_projection_v1($1)`,[hash]);
  const first=(await read('signature')).rows[0],catalog=(await read('repository')).rows[0];
  assert.deepEqual(first.payload,project(original));assert.ok(size(first)<size(original)/100);
  assert.doesNotMatch(JSON.stringify(catalog.payload),/privateSource|privateAnswers|master@example/);
  await db.exec("update public.portal_runtime_state set revision=8,payload=jsonb_set(payload,'{emailDeliveries,0,html}','\"changed email\"'::jsonb)");
  assert.deepEqual((await read('signature',first.fingerprint)).rows[0],{...first,revision:8,payload:null});
  assert.deepEqual((await read('repository',catalog.fingerprint)).rows[0],{...catalog,revision:8,payload:null});
  await db.exec("update public.portal_runtime_state set revision=9,payload=jsonb_set(payload,'{authorizedStudents,0,active}','false'::jsonb)");
  const revoked=(await read('signature',first.fingerprint)).rows[0];assert.equal(revoked.payload.authorizedStudents[0].active,false);assert.notEqual(revoked.fingerprint,first.fingerprint);
  await db.exec("update public.portal_runtime_state set revision=10,payload=jsonb_set(payload,'{revokedSessionIds}','[\"session\"]'::jsonb)");
  assert.deepEqual((await read('signature',revoked.fingerprint)).rows[0].payload.revokedSessionIds,['session']);
  await db.exec("update public.portal_runtime_state set revision=11,payload=jsonb_set(payload,'{signatureJobs,0,status}','\"SIGNED\"'::jsonb)");
  assert.equal((await read('signature',first.fingerprint)).rows[0].payload.signatureJobs[0].status,'SIGNED');
  await db.exec("update public.portal_runtime_state set revision=12,payload=jsonb_set(payload,'{legacyAcademicRecords,0,provenance,publicationWithdrawal}','{\"withdrawnAt\":\"2026-11-17\"}'::jsonb)");
  const withdrawn=(await read('repository',catalog.fingerprint)).rows[0];assert.notEqual(withdrawn.payload,null);assert.equal(withdrawn.payload.legacyAcademicRecords[0].provenance.publicationWithdrawal.withdrawnAt,'2026-11-17');
  const canonical=(await db.query<any>('select * from public.portal_runtime_state')).rows[0];assert.equal(canonical.revision,12);assert.deepEqual(canonical.payload.auditLogs,original.auditLogs);
  for(const kind of ['signature','repository']as const){
   await assert.rejects(read(kind,'bad'),/Invalid .* fingerprint/);
   for(const role of ['anon','authenticated']){await db.exec('set role '+role);await assert.rejects(read(kind),/permission denied/);await db.exec('reset role');}
   await db.exec('set role service_role');assert.equal((await read(kind)).rows[0].revision,12);await db.exec('reset role');
   assert.equal((await db.query<any>("select prosecdef from pg_proc where oid=$1::regprocedure",[`public.portal_read_${kind}_projection_v1(text)`])).rows[0].prosecdef,false);
  }
 }finally{await db.close();}
});

test('signature reader reuses only verified content; email churn is small, revocation changes content, no partial CAS baseline',async t=>{
 configure(t,'https://signature-projection.invalid');let revision=7;const state=fixture(),calls:Array<{path:string;bytes:number}>=[];
 t.mock.method(globalThis,'fetch',async(url:any,init?:RequestInit)=>{
  const path=new URL(url).pathname;let body:unknown;
  if(path===signatureRpc){const sent=JSON.parse(String(init?.body));const payload=project(state),hash=fingerprint(payload);body=[{revision,fingerprint:hash,payload:sent.known_fingerprint===hash?null:payload}];}
  else{assert.equal(new URL(url).searchParams.get('select'),'revision');body=[{revision}];}
  calls.push({path,bytes:size(body)});return Response.json(body);
 });
 const first=await refreshPortalSignatureState<any>();assert.equal(portalRuntimeSnapshotRevision(first),7);first.processes[0].id='uncommitted';
 assert.equal((await refreshPortalSignatureState<any>()).processes[0].id,'one');assert.equal(calls.at(-1)?.bytes,16);
 state.emailDeliveries[0].html='changed';revision++;
 assert.equal((await refreshPortalSignatureState<any>()).signatureJobs[0].status,'SENT');assert.ok(calls.at(-1)!.bytes<160);
 state.authorizedStudents[0].active=false;state.removedAccessProcessKeys.push('author@example.invalid|one');revision++;
 const revoked=await refreshPortalSignatureState<any>();assert.equal(revoked.authorizedStudents[0].active,false);assert.deepEqual(revoked.removedAccessProcessKeys,state.removedAccessProcessKeys);
 state.signatureJobs[0].status='SIGNED';revision++;
 assert.equal((await refreshPortalSignatureState<any>()).signatureJobs[0].status,'SIGNED');
 assert.equal(currentPortalRuntimeRevision(),null);assert.equal(readCachedPortalRuntimeState(revision),null);
 t.diagnostic(JSON.stringify({fixture:true,signatureResponseBytes:calls[0].bytes,emailOnlyResponseBytes:calls[3].bytes}));
});

test('catalog reader returns current revision with matching content and refreshes withdrawal; result cannot mutate cache',async t=>{
 configure(t,'https://repository-projection.invalid');let revision=7,denied=false,invalid=false;
 const payload={processes:[{id:'one',titulo:'Fixture'}],legacyAcademicRecords:[{id:'legacy',provenance:{originalConsent:['Sim'],publicationWithdrawal:null as unknown}}]},calls:number[]=[];
 t.mock.method(globalThis,'fetch',async(url:any,init?:RequestInit)=>{
  assert.equal(new URL(url).pathname,repositoryRpc);
  if(denied)return Response.json({code:'42501'},{status:403});
  const sent=JSON.parse(String(init?.body)),hash=fingerprint(payload),body=[{revision,fingerprint:invalid?'b'.repeat(64):hash,payload:invalid||sent.known_fingerprint===hash?null:payload}];calls.push(size(body));return Response.json(body);
 });
 const first=await loadPortalRepositorySnapshot();first.processes[0].titulo='mutated';revision++;
 assert.equal((await loadPortalRepositorySnapshot()).processes[0].titulo,'Fixture');assert.ok(calls[1]<160);
 payload.legacyAcademicRecords[0].provenance.publicationWithdrawal={withdrawnAt:'2026-11-17'};revision++;
 assert.deepEqual((await loadPortalRepositorySnapshot()).legacyAcademicRecords[0].provenance.publicationWithdrawal,{withdrawnAt:'2026-11-17'});
 invalid=true;await assert.rejects(loadPortalRepositorySnapshot(),/não confirmado/);
 denied=true;await assert.rejects(loadPortalRepositorySnapshot(),/403/);
 assert.equal(currentPortalRuntimeRevision(),null);assert.equal(readCachedPortalRuntimeState(revision),null);
});

test('signature acknowledgements cannot reuse another fingerprint or omit session/ACL collections',async t=>{
 configure(t,'https://signature-proof.invalid');let revision=7,mode='valid';const payload=project(fixture()),hash=fingerprint(payload);
 t.mock.method(globalThis,'fetch',async(url:any)=>{
  if(new URL(url).pathname!==signatureRpc)return Response.json([{revision}]);
  return Response.json([{revision,fingerprint:mode==='wrong-hash'?'b'.repeat(64):hash,
   payload:mode==='wrong-hash'?null:mode==='missing-acl'?{settings:{},processes:[],signatureJobs:[]}:payload}]);
 });
 assert.ok(await refreshPortalSignatureState());revision++;
 mode='wrong-hash';await assert.rejects(refreshPortalSignatureState(),/não confirmou/);
 mode='missing-acl';await assert.rejects(refreshPortalSignatureState(),/dados inválidos/);
});

test('missing additive RPCs use the confirmed installed projections; denied/invalid signature reads never fall back',async t=>{
 configure(t,'https://missing-conditional-status.invalid');const calls:string[]=[];let denied=false;
 t.mock.method(globalThis,'fetch',async(url:any)=>{
  const path=new URL(url).pathname;calls.push(path);
  if(path===signatureRpc||path===repositoryRpc)return Response.json({code:'PGRST202'},{status:404});
  if(path.endsWith('/portal_read_runtime_projection_v1'))return Response.json([{revision:7,fingerprint:'a'.repeat(64),payload:fixture()}].map(row=>({...row,payload:project(row.payload)})));
  assert.ok(path.endsWith('/portal_read_repository_v1'));return Response.json([{revision:7,payload:{processes:[],legacyAcademicRecords:[]}}]);
 });
 assert.ok(await refreshPortalSignatureState());assert.deepEqual(await loadPortalRepositorySnapshot(),{revision:7,processes:[],legacyAcademicRecords:[]});
 assert.ok(calls.includes('/rest/v1/rpc/portal_read_runtime_projection_v1'));assert.ok(calls.includes('/rest/v1/rpc/portal_read_repository_v1'));
 process.env.SUPABASE_URL='https://denied-conditional-status.invalid';
 t.mock.method(globalThis,'fetch',async()=>denied?Response.json({code:'42501'},{status:403}):Response.json([{revision:7,fingerprint:'a'.repeat(64),payload:{...project(fixture()),emailDeliveries:[]}}]));
 await assert.rejects(refreshPortalSignatureState(),/dados inválidos/);denied=true;await assert.rejects(refreshPortalSignatureState(),/403/);
});

test('signature-triggered recovery retains its FIFO and full refresh before workflows/providers',async()=>{
 const source=await readFile('server.ts','utf8');
 for(const[name,end]of [['scheduleRepositorySignatureRecovery','function currentAstenCheckDue'],['scheduleCurrentAstenCheck','async function recoverReservationNotices']]){
  const start=source.indexOf(`function ${name}`),stop=source.indexOf(end,start),body=source.slice(start,stop);
  assert.ok(start>0&&stop>start);assert.match(body,/await acquireRuntimeRequest\(\)/);assert.match(body,/await refreshPortalRuntimeState<PersistedPortalState>\(\)/);
 }
 assert.match(source,/readProjection==='SIGNATURES'\s*\?await refreshPortalSignatureState/);
 assert.match(source,/if\(state\.registrationDrafts\)registrationDraftsStore=/);
});

test('production startup does not import the development Vite server eagerly',async()=>{
 const source=await readFile('server.ts','utf8');
 assert.doesNotMatch(source,/^import .*from ['"]vite['"]/m);
 const index=source.indexOf("await import('vite')");assert.ok(index>source.indexOf('export async function createPortalApp'));
 assert.match(source.slice(index,index+300),/createViteServer\(/);
});
