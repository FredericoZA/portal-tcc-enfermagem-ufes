import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {PGlite} from '@electric-sql/pglite';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';

test('Supabase projects the new protocol and keeps old codes and uniqueness',async()=>{
  const db=new PGlite({extensions:{pgcrypto}});
  try{
    await db.exec('create role anon; create role authenticated; create role service_role; create schema auth; create function auth.uid() returns uuid language sql as $$select null::uuid$$;');
    for(const migration of ['202608270001_portal_producao','202608290001_portal_normalized_core','202608310001_portal_transactional_runtime','20260911102237_portal_author_access_trigger_fix']){
      await db.exec(await readFile(`supabase/migrations/${migration}.sql`,'utf8'));
    }
    const student={email:'test@example.invalid',nome:'Autora de Teste'};
    const entry=(id:string,protocolo:string)=>({id,protocolo,titulo:'Trabalho de Teste',aluno1:student});
    const initial={processes:[entry('old','TCC-2026-0001')]};
    const commit=(revision:number,payload:unknown)=>db.query('select portal_commit_runtime_state($1,$2::jsonb)',[revision,JSON.stringify(payload)]);
    await commit(0,initial);
    const processes=[...initial.processes,entry('new','TCC - 00006')];
    await assert.rejects(commit(1,{processes}),/portal_processes_code_check/);
    await db.exec(await readFile('supabase/migrations/20261105172558_accept_serial_tcc_protocol.sql','utf8'));
    await commit(1,{processes});
    const saved=await db.query<{code:string}>('select code from portal_processes order by external_id');
    assert.deepEqual(saved.rows.map(row=>row.code),['TCC - 00006','TCC-2026-0001']);
    await assert.rejects(commit(1,{processes}),/concorrência/);
    await assert.rejects(commit(2,{processes:[...processes,entry('duplicate','TCC - 00006')]}),/portal_processes_code_key/);
    await assert.rejects(commit(2,{processes:[...processes,entry('bad','TCC - 0006')]}),/portal_processes_code_check/);
  }finally{await db.close();}
});

test('controlled correction retains issued artifacts and assigns old references to their current owners',async()=>{
  const db=new PGlite({extensions:{pgcrypto}});
  try{
    await db.exec('create role anon; create role authenticated; create role service_role; create schema auth; create function auth.uid() returns uuid language sql as $$select null::uuid$$;');
    for(const migration of ['202608270001_portal_producao','202608290001_portal_normalized_core','202608310001_portal_transactional_runtime','20260911102237_portal_author_access_trigger_fix','20260918170000_portal_runtime_assets_v10','20261105172558_accept_serial_tcc_protocol']){
      await db.exec(await readFile(`supabase/migrations/${migration}.sql`,'utf8'));
    }
    await db.exec(await readFile('scripts/repair-serial-process-protocols.sql','utf8'));
    const processes=[
      {id:'real',protocolo:'TCC-2026-0001',previousProtocols:['TCC-2026-0006'],titulo:'Trabalho institucional',aluno1:{email:'real@example.invalid',nome:'Autor Real'},dataRevision:4},
      {id:'pilot',protocolo:'TCC-2026-0006',previousProtocols:[],titulo:'Trabalho piloto',aluno1:{email:'pilot@example.invalid',nome:'Autor Piloto'},dataRevision:2,
        driveFolderId:'private-folder',defesa:{invitationDriveFileId:'invitation-0006',localStatus:'CONFIRMADO'}},
    ];
    const counters={'TCC-2026':6,'ENF-2025':22};
    const existingAudit={id:'original-event',timestamp:'2026-11-05T12:00:00Z',action:'ENVIO_TESTE',entityType:'processo',entityId:'pilot'};
    const initial={processes,processProtocolCounters:counters,auditLogs:[existingAudit],legacyAcademicRecords:[{id:'legacy',protocolo:'001 - Legado'}],emailDeliveries:[{id:'mail',processId:'pilot',recipient:'pilot@example.invalid',idempotencyKey:'test-invitation',status:'ACCEPTED_BY_GMAIL',subject:'[TCC-2026-0006] Convite'}]};
    const commit=(revision:number,payload:unknown)=>db.query('select portal_commit_runtime_state($1,$2::jsonb)',[revision,JSON.stringify(payload)]);
    const repair=(revision:number,realId='real',pilotId='pilot')=>db.query<{revision:number}>('select pg_temp.repair_serial_process_protocols($1,$2,$3)::int as revision',[revision,realId,pilotId]);
    await commit(0,initial);
    await assert.rejects(repair(0),/revisão do portal mudou/);
    await assert.rejects(repair(1,'pilot','real'),/protocolos, a projeção ou o contador mudaram/);
    assert.deepEqual((await repair(1)).rows,[{revision:2}]);
    assert.deepEqual((await repair(2)).rows,[{revision:2}]);
    const saved=await db.query<{payload:typeof initial}>('select payload from portal_runtime_state where id = $1',['global']);
    const {payload}=saved.rows[0];
    assert.deepEqual(payload.processes,[{...processes[0],protocolo:'TCC - 00001',previousProtocols:['TCC-2026-0001']},{...processes[1],protocolo:'TCC - 00002',previousProtocols:['TCC-2026-0006']}]);
    assert.deepEqual(payload.processProtocolCounters,{...counters,'TCC-9999':2});
    assert.deepEqual(payload.emailDeliveries,initial.emailDeliveries);
    assert.deepEqual(payload.legacyAcademicRecords,initial.legacyAcademicRecords);
    assert.deepEqual(payload.auditLogs[0],existingAudit);
    assert.deepEqual(payload.auditLogs.slice(1).map(log=>log.id).sort(),['serial-protocol-repair-pilot','serial-protocol-repair-real']);
    const projected=await db.query<{code:string}>('select code from portal_processes order by external_id');
    assert.deepEqual(projected.rows,[{code:'TCC - 00002'},{code:'TCC - 00001'}]);
    const backups=await db.query<{payload:typeof initial}>('select payload from portal_runtime_state_backups');
    assert.deepEqual(backups.rows,[{payload:initial}]);
  }finally{await db.close();}
});
