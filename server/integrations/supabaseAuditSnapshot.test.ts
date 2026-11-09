import test from 'node:test';
import assert from 'node:assert/strict';
import { AuditSnapshotAssembler } from './supabaseAuditSnapshot';
import { loadPortalRuntimeState } from './supabase';

const one='a'.repeat(64);
const two='b'.repeat(64);

test('chunks conhecidos são reconstruídos sem baixar novamente o histórico',()=>{
  const assembler=new AuditSnapshotAssembler();
  assert.deepEqual(assembler.fingerprints('project-1'),[]);
  const first=assembler.reconstruct('project-1',[{
    revision:10,payload:{processes:[{id:'p1'}]},audit_chunks:[
      {fingerprint:one,events:[{id:'aud-1'}]},
      {fingerprint:two,events:[{id:'aud-2'}]},
    ],
  }]);
  assert.deepEqual(first.payload.auditLogs,[{id:'aud-1'},{id:'aud-2'}]);
  assert.deepEqual(assembler.fingerprints('project-1'),[one,two]);
  const second=assembler.reconstruct('project-1',[{
    revision:11,payload:{processes:[{id:'p2'}]},audit_chunks:[{fingerprint:one},{fingerprint:two}],
  }]);
  assert.deepEqual(second.payload.auditLogs,[{id:'aud-1'},{id:'aud-2'}]);
  assert.deepEqual(second.payload.processes,[{id:'p2'}]);
});

test('falha fechado se faltar qualquer bloco, sem substituir histórico por lista vazia',()=>{
  const assembler=new AuditSnapshotAssembler();
  assembler.reconstruct('project-1',[{revision:1,payload:{},audit_chunks:[{fingerprint:one,events:[1]}]}]);
  assert.throws(()=>assembler.reconstruct('project-1',[{
    revision:2,payload:{},audit_chunks:[{fingerprint:one},{fingerprint:two}],
  }]),/ausente/);
  assert.deepEqual(assembler.fingerprints('project-1'),[one]);
  assert.throws(()=>assembler.reconstruct('project-1',[{revision:2,payload:{},audit_chunks:[]} ,{}]),/inválido/);
  assert.deepEqual(assembler.fingerprints('project-2'),[],'nunca transportar cache entre projetos');
  assert.throws(()=>assembler.reconstruct('project-2',[{revision:3,payload:{},audit_chunks:[{fingerprint:one}]}]),/ausente/);
});

test('modo opt-in lê RPC de deltas, sem afetar a leitura integral legada',async()=>{
  const originalFetch=globalThis.fetch;
  const names=['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','SUPABASE_SECRET_KEY','PORTAL_PERSISTENCE_PROVIDER','PORTAL_AUDIT_DELTA_ENABLED'] as const;
  const previous=Object.fromEntries(names.map(key=>[key,process.env[key]]));
  const requests:string[]=[];
  try{
    process.env.SUPABASE_URL='https://audit-delta-fixture.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY='fixture-only';
    delete process.env.SUPABASE_SECRET_KEY;
    process.env.PORTAL_PERSISTENCE_PROVIDER='supabase';
    process.env.PORTAL_AUDIT_DELTA_ENABLED='true';
    let calls=0;
    globalThis.fetch=async(url,init)=>{
      requests.push(String(url));
      assert.match(String(url),/portal_read_runtime_snapshot_v1/);
      assert.equal(init?.method,'POST');
      const body=JSON.parse(String(init.body));
      calls++;
      if(calls===1){
        assert.deepEqual(body.known_audit_chunks,[]);
        return Response.json([{revision:7,payload:{processes:[]},audit_chunks:[{fingerprint:one,events:[{id:'audit-1'}]}]}]);
      }
      assert.deepEqual(body.known_audit_chunks,[one]);
      return Response.json([{revision:8,payload:{processes:[{id:'p1'}]},audit_chunks:[{fingerprint:one}]}]);
    };
    assert.deepEqual(await loadPortalRuntimeState(false),{processes:[],auditLogs:[{id:'audit-1'}]});
    assert.deepEqual(await loadPortalRuntimeState(false),{processes:[{id:'p1'}],auditLogs:[{id:'audit-1'}]});
    assert.equal(requests.length,2);
  } finally{
    globalThis.fetch=originalFetch;
    for(const name of names){
      const value=previous[name];
      if(value===undefined)delete process.env[name];else process.env[name]=value;
    }
  }
});
