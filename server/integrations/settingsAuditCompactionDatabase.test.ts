import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

test('expurgo conservador conserva evidencias, backup e CAS; e idempotente',async()=>{
  const db=new PGlite();
  try{
    await db.exec(`create table portal_runtime_state(id text primary key,revision bigint not null,payload jsonb not null,updated_at timestamptz default now());
      create table portal_audit_events(external_id text primary key,event_type text not null,details jsonb not null);
      create table portal_runtime_state_backups(
        backup_id bigint generated always as identity primary key,
        state_id text not null,revision bigint not null,payload jsonb not null,
        reason text not null,created_at timestamptz default now()
      );
      create function portal_commit_runtime_state(expected_revision bigint,next_payload jsonb)
      returns bigint language plpgsql as $$
      declare output bigint;
      begin
        update portal_runtime_state set payload=next_payload,revision=revision+1,updated_at=now()
        where id='global' and revision=expected_revision returning revision into output;
        if output is null then raise exception 'stale revision';end if;
        return output;
      end $$;`);
    const archived={id:'log-1793000000000',action:'ALTERACAO_CONFIGURACOES',
      entityType:'settings',before:{site:'anterior',unmodified:'mantido'},
      after:{site:'novo',unmodified:'mantido'},timestamp:'2026-11-01'};
    const noArchive={...archived,id:'log-1793000000001',before:{site:'outro'}};
    const processLog={id:'log-1793000000002',action:'CRIACAO_PROCESSO',processId:'tcc-1',after:{status:'ABERTO'}};
    const source={auditLogs:[archived,noArchive,processLog],legacyAcademicRecords:[{id:'legado'}],settings:{current:'sem mudanca'}};
    await db.query('insert into portal_runtime_state(id,revision,payload) values($1,5,$2::jsonb)',['global',JSON.stringify(source)]);
    await db.query('insert into portal_audit_events(external_id,event_type,details) values($1,$2,$3::jsonb)',[
      archived.id,'ALTERACAO_CONFIGURACOES',JSON.stringify({before:archived.before,after:archived.after})
    ]);
    const sql=await readFile('supabase/maintenance/20261111_compact_settings_audit.sql','utf8');
    await db.exec(sql);
    const state=(await db.query<{revision:number;payload:any}>('select revision,payload from portal_runtime_state')).rows[0];
    assert.equal(state.revision,6);
    assert.deepEqual(state.payload.auditLogs[0].before,{archivedAuditId:archived.id});
    assert.deepEqual(state.payload.auditLogs[0].after.changedPaths,['site']);
    assert.deepEqual(state.payload.auditLogs[1],noArchive);
    assert.deepEqual(state.payload.auditLogs[2],processLog);
    assert.deepEqual(state.payload.legacyAcademicRecords,source.legacyAcademicRecords);
    assert.deepEqual(state.payload.settings,source.settings);
    const backup=(await db.query<{payload:any}>('select payload from portal_runtime_state_backups')).rows;
    assert.deepEqual(backup[0].payload,source);
    await db.exec(sql);
    assert.equal((await db.query<{n:number}>('select count(*)::int n from portal_runtime_state_backups')).rows[0].n,1);
    assert.equal((await db.query<{revision:number}>('select revision from portal_runtime_state')).rows[0].revision,6);
  }finally{await db.close();}
});
