import test from 'node:test';
import assert from 'node:assert/strict';
import {loadPortalRuntimeState,refreshPortalRuntimeState,saveRegistrationDraftRuntimeState as commitDraft,currentPortalRuntimeRevision} from './supabase';
import type {RegistrationDraft} from '../../src/types/workflowOperations';

test('draft adapter sends only its record, confirms exact ACK without replay, and keeps the canonical cache isolated',async t=>{
  const keys=['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','SUPABASE_SECRET_KEY','PORTAL_PERSISTENCE_PROVIDER','PORTAL_RUNTIME_AUDIT_DELTA'] as const;
  const previous=Object.fromEntries(keys.map(key=>[key,process.env[key]]));
  t.after(()=>{for(const key of keys){if(previous[key]===undefined)delete process.env[key];else process.env[key]=previous[key];}});
  process.env.SUPABASE_URL='https://draft-unit.supabase.co';process.env.SUPABASE_SERVICE_ROLE_KEY='unit-test';delete process.env.SUPABASE_SECRET_KEY;process.env.PORTAL_PERSISTENCE_PROVIDER='supabase';process.env.PORTAL_RUNTIME_AUDIT_DELTA='false';
  const owner='draft@example.invalid';
  const draft=(revision:number):RegistrationDraft=>({ownerEmail:owner,answers:{ALUNO_1_EMAIL:owner,ALUNO_1_NOME:'Pessoa'},section:2,revision,schemaRevision:9,updatedAt:'2026-11-07T12:00:00Z',expiresAt:'2099-11-07T12:00:00Z'});
  const saveRegistrationDraftRuntimeState=(email:string,value:RegistrationDraft,previous:number)=>commitDraft(email,value,previous,currentPortalRuntimeRevision());
  let revision=40,posts=0,fullReads=0;
  let outcome:'ok'|'lost'|'mismatch'|'readfail'|'missing'|'conflict'|'forbidden'='ok';
  let remote:any={settings:{integrationStudio:{revision:9}},processes:[{payload:'x'.repeat(1_000_000)}],registrationDrafts:{other:{keep:true}}};
  t.mock.method(globalThis,'fetch',async(url:any,options:any)=>{
    const parsed=new URL(String(url));
    if(parsed.pathname.endsWith('/portal_runtime_commits'))return Response.json([]);
    if(options?.method==='POST'){
      posts++;assert.ok(parsed.pathname.endsWith('/rpc/portal_commit_registration_draft'));
      assert.ok(String(options.body).length<1000,'A megabyte-sized unrelated process must not travel with a draft.');
      const body=JSON.parse(options.body);assert.equal(body.expected_revision,revision);assert.equal(body.draft_owner,owner);
      if(outcome==='missing')return Response.json({code:'PGRST202'},{status:404});
      if(outcome==='conflict')return Response.json({code:'PT409'},{status:409});
      if(outcome==='forbidden')return Response.json({code:'42501'},{status:403});
      remote={...remote,registrationDrafts:{...remote.registrationDrafts,[owner]:body.next_draft}};revision++;
      if(outcome==='mismatch')remote={...remote,unauthorizedExtra:true};
      if(outcome!=='ok')throw new Error('lost ACK');
      return Response.json(revision);
    }
    if(parsed.searchParams.get('select')==='revision')return Response.json([{revision}]);
    fullReads++;if(outcome==='readfail')throw new Error('read failed');
    return Response.json([{revision,payload:remote}]);
  });
  const mutable=await loadPortalRuntimeState<any>();mutable.processes[0].payload='dirty runtime mutation';
  await assert.rejects(commitDraft(owner,draft(1),0,39),/revisão atual/);assert.equal(posts,0);
  const first=draft(1);assert.equal(await saveRegistrationDraftRuntimeState(owner,first,0),true);
  first.answers.ALUNO_1_NOME='mutated after commit';
  assert.equal(posts,1);assert.equal(fullReads,1);
  let state=await refreshPortalRuntimeState<any>();
  assert.equal(state.processes[0].payload.length,1_000_000);assert.equal(state.registrationDrafts[owner].answers.ALUNO_1_NOME,'Pessoa');assert.deepEqual(state.registrationDrafts.other,{keep:true});
  outcome='lost';assert.equal(await saveRegistrationDraftRuntimeState(owner,draft(2),1),true);assert.equal(posts,2);assert.equal(fullReads,2);assert.equal(currentPortalRuntimeRevision(),42);
  for(const rejected of ['missing','conflict','forbidden'] as const){
    outcome=rejected;const before=posts;
    if(rejected==='missing')assert.equal(await saveRegistrationDraftRuntimeState(owner,draft(3),2),false);
    else await assert.rejects(saveRegistrationDraftRuntimeState(owner,draft(3),2),rejected==='conflict'?/concorrência/:/403/);
    assert.equal(posts,before+1);assert.equal(currentPortalRuntimeRevision(),42);
  }
  outcome='mismatch';await assert.rejects(saveRegistrationDraftRuntimeState(owner,draft(3),2),/lost ACK/);assert.equal(currentPortalRuntimeRevision(),42);
  // Refresh after the uncertain result before another write; no automatic replay.
  outcome='ok';await loadPortalRuntimeState();const before=posts;
  outcome='readfail';await assert.rejects(saveRegistrationDraftRuntimeState(owner,draft(4),3),/lost ACK/);assert.equal(posts,before+1);assert.equal(currentPortalRuntimeRevision(),43);
});
