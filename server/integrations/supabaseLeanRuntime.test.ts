import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {loadPortalRuntimeLeanState, refreshPortalRuntimeLeanState, readArchivedSettingsBefore} from './supabase';

const migration='supabase/migrations/20261111171000_runtime_lean_v1.sql';

test('leitura minima omite historico e acervo sem modifica-los nem conceder acesso publico', async()=>{
  const db=new PGlite();
  try{
    await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
      create table portal_runtime_state(id text primary key,revision bigint not null,payload jsonb not null);
      grant select on portal_runtime_state to service_role;
      insert into portal_runtime_state values('global',7,'{"auditLogs":[{"id":"evidence"}],"legacyAcademicRecords":[{"id":"historical"}],"settings":{"safe":true},"processes":[{"id":"tcc-1"}]}');`);
    await db.exec(await readFile(migration,'utf8'));
    const read=async()=>db.query<{revision:number;payload:any}>('select * from public.portal_read_runtime_lean_v1()');
    assert.deepEqual((await read()).rows,[{revision:7,payload:{settings:{safe:true},processes:[{id:'tcc-1'}]}}]);
    const canonical=(await db.query<{payload:any}>('select payload from portal_runtime_state')).rows[0].payload;
    assert.equal(canonical.auditLogs[0].id,'evidence');
    assert.equal(canonical.legacyAcademicRecords[0].id,'historical');
    for(const role of ['anon','authenticated']){
      await db.exec('set role '+role);
      await assert.rejects(read(),/permission denied/);
      await db.exec('reset role');
    }
    await db.exec('set role service_role');
    assert.equal((await read()).rows[0].revision,7);
  }finally{await db.close();}
});
test('leitura minima usa somente revisao confirmada e nunca aceita payload incompleto inesperado', async t=>{
  for(const [key,value] of Object.entries({
    SUPABASE_URL:'https://lean-runtime.invalid',SUPABASE_SECRET_KEY:'fixture',
    PORTAL_PERSISTENCE_PROVIDER:'supabase',PORTAL_RUNTIME_WIRE_SNAPSHOT:'false',
    PORTAL_RUNTIME_AUDIT_DELTA:'false'
  })){const prev=process.env[key];process.env[key]=value;t.after(()=>{if(prev===undefined)delete process.env[key];else process.env[key]=prev;});}
  let revision=7,invalid=false,denied=false;
  const paths:string[]=[];
  t.mock.method(globalThis,'fetch',async(url:any)=>{
    const target=new URL(url);
    paths.push(target.pathname);
    if(denied)return Response.json({code:'42501'},{status:403});
    if(target.pathname.endsWith('/portal_read_runtime_lean_v1'))
      return Response.json([{revision,payload:invalid?{auditLogs:[]}: {settings:{marker:revision}}}]);
    if(target.pathname==='/rest/v1/portal_runtime_state')return Response.json([{revision}]);
    throw new Error('Unexpected path '+target.pathname);
  });
  assert.deepEqual(await loadPortalRuntimeLeanState(),{settings:{marker:7}});
  assert.deepEqual(await refreshPortalRuntimeLeanState(),{settings:{marker:7}});
  revision=8;
  assert.deepEqual(await refreshPortalRuntimeLeanState(),{settings:{marker:8}});
  assert.deepEqual(paths,['/rest/v1/rpc/portal_read_runtime_lean_v1',
    '/rest/v1/portal_runtime_state','/rest/v1/portal_runtime_state','/rest/v1/rpc/portal_read_runtime_lean_v1']);
  invalid=true;
  await assert.rejects(loadPortalRuntimeLeanState(),/projeção mínima/);
  denied=true;
  await assert.rejects(loadPortalRuntimeLeanState(),/403/);
});
test('recuperacao privada de configuracoes arquivadas busca somente o evento especifico',async t=>{
  for(const [key,value] of Object.entries({SUPABASE_URL:'https://audit-archive.invalid',SUPABASE_SECRET_KEY:'fixture',PORTAL_PERSISTENCE_PROVIDER:'supabase'})){
    const prev=process.env[key];process.env[key]=value;t.after(()=>{if(prev===undefined)delete process.env[key];else process.env[key]=prev;});
  }
  let called=0;
  t.mock.method(globalThis,'fetch',async(url:any)=>{
    const u=new URL(url);called++;
    assert.equal(u.pathname,'/rest/v1/portal_audit_events');
    assert.equal(u.searchParams.get('external_id'),'eq.log-12345678901');
    assert.equal(u.searchParams.get('event_type'),'eq.ALTERACAO_CONFIGURACOES');
    return Response.json([{details:{before:{site:'prior'}}}]);
  });
  assert.deepEqual(await readArchivedSettingsBefore('log-12345678901'),{site:'prior'});
  await assert.rejects(readArchivedSettingsBefore('unsafe-id'),/inválido/);
  assert.equal(called,1);
});
test('o middleware preserva o catalogo carregado quando a projeção omite acervo',async()=>{
  const server=await readFile('server.ts','utf8');
  assert.match(server,/if \(Array\.isArray\(state\.legacyAcademicRecords\)\) legacyAcademicRecordsStore=/);
  assert.match(server,/isLeanRuntimeRead\(req\.method,req\.path\)/);
  assert.match(server,/const remote = liteRuntimeReadsEnabled\s*\? await loadPortalRuntimeLeanState/);
  assert.match(server,/const LITE_RUNTIME_READ_PATHS = new Set/);
  assert.match(server,/\'\/public\/repository\'/);
  assert.match(server,/await readArchivedSettingsBefore\(log\.id\)/);
});
