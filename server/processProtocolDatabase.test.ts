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
