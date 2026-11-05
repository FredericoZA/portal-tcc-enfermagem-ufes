import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {DEFAULT_INSTALLATION_PROFILE} from '../../src/constants/installation';
import {reserveNextProcessProtocol,type ProcessProtocolCounters} from './processProtocol';

interface SequenceSnapshot {
  processes: Array<{id:string;protocolo:string}>;
  processProtocolCounters: ProcessProtocolCounters;
}

test('runtime CAS commits the process and counter together and rejects a competing allocation',async()=>{
  const db=new PGlite();
  try{
    await db.exec(`create table portal_runtime_state(id text primary key,payload jsonb,revision bigint,updated_at timestamptz);
      create table portal_runtime_commits(revision bigint primary key,payload_sha256 text);
      create function digest(text,text) returns bytea language sql immutable as $$select sha256(convert_to($1,'UTF8'))$$;
      create function portal_project_runtime_state(jsonb) returns void language plpgsql as $$begin return;end$$;
      create function portal_project_runtime_state_v4(jsonb) returns void language plpgsql as $$begin return;end$$;
      create function portal_project_publications_v8(jsonb) returns void language plpgsql as $$begin return;end$$;`);
    const migration=await readFile('supabase/migrations/20260911183500_portal_publication_security_v8.sql','utf8');
    const commitFunction=migration.match(/create or replace function public\.portal_commit_runtime_state\(expected_revision bigint, next_payload jsonb\)[\s\S]*?\$\$;/)?.[0];
    assert.ok(commitFunction);
    await db.exec(commitFunction);
    await db.exec(await readFile('supabase/migrations/20261015205624_runtime_conflict_no_retry.sql','utf8'));
    const commit=(revision:number,payload:SequenceSnapshot)=>db.query<{revision:number}>('select portal_commit_runtime_state($1,$2) revision',[revision,JSON.stringify(payload)]);
    const load=async()=>{const result=await db.query<{payload:SequenceSnapshot;revision:number}>("select payload,revision::int revision from portal_runtime_state where id='global'");return result.rows[0];};
    const first=reserveNextProcessProtocol(DEFAULT_INSTALLATION_PROFILE,2026,{});
    await commit(0,{processes:[{id:'first',protocolo:first.protocol}],processProtocolCounters:first.counters});
    const stale=await load();
    const candidate=(id:string)=>{
      const allocation=reserveNextProcessProtocol(DEFAULT_INSTALLATION_PROFILE,2026,stale.payload.processProtocolCounters,stale.payload.processes.map(process=>process.protocolo));
      return {processes:[...stale.payload.processes,{id,protocolo:allocation.protocol}],processProtocolCounters:allocation.counters};
    };
    const competing=await Promise.allSettled([commit(stale.revision,candidate('second-a')),commit(stale.revision,candidate('second-b'))]);
    assert.equal(competing.filter(result=>result.status==='fulfilled').length,1);
    const rejected=competing.find(result=>result.status==='rejected');
    assert.ok(rejected?.status==='rejected');
    assert.equal(rejected.reason.code,'PT409');
    const current=await load();
    assert.equal(current.revision,2);
    assert.equal(current.payload.processProtocolCounters['TCC-2026'],2);
    assert.deepEqual(current.payload.processes.map(process=>process.protocolo),['TCC-2026-0001','TCC-2026-0002']);
    await commit(current.revision,{...current.payload,processes:[]});
    const restarted=await load();
    const next=reserveNextProcessProtocol(DEFAULT_INSTALLATION_PROFILE,2026,restarted.payload.processProtocolCounters,restarted.payload.processes.map(process=>process.protocolo));
    assert.equal(next.protocol,'TCC-2026-0003');
    await commit(restarted.revision,{processes:[{id:'third',protocolo:next.protocol}],processProtocolCounters:next.counters});
    assert.equal((await load()).payload.processProtocolCounters['TCC-2026'],3);
  }finally{await db.close();}
});
