import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadPortalRuntimeState, portalRuntimeStateNeedsRefresh } from './supabase';

test('consulta apenas revisão quando snapshot local está atualizado e falha fechada em erro remoto', async () => {
  const originalFetch=globalThis.fetch;
  const names=['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','SUPABASE_SECRET_KEY','PORTAL_PERSISTENCE_PROVIDER'] as const;
  const original=Object.fromEntries(names.map(name=>[name,process.env[name]]));
  let remoteRevision=7;
  let fullReads=0;
  let revisionReads=0;
  let failRevision=false;
  try {
    process.env.SUPABASE_URL='https://revision-gate-test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY='local-test-key';
    delete process.env.SUPABASE_SECRET_KEY;
    process.env.PORTAL_PERSISTENCE_PROVIDER='supabase';
    globalThis.fetch=async(url)=>{
      const path=String(url);
      if(path.includes('select=payload,revision')){
        fullReads++;
        return Response.json([{revision:remoteRevision,payload:{safe:'state'}}]);
      }
      if(path.includes('select=revision')){
        revisionReads++;
        if(failRevision)return Response.json({message:'unavailable'},{status:503});
        return Response.json([{revision:remoteRevision}]);
      }
      throw new Error('Unexpected request: '+path);
    };
    // Uma instância recém-inicializada precisa sempre hidratar o estado.
    assert.equal(await portalRuntimeStateNeedsRefresh(),true);
    assert.deepEqual(await loadPortalRuntimeState(),{safe:'state'});
    assert.equal(fullReads,1);
    // Repetir uma consulta não transfere o payload completo.
    assert.equal(await portalRuntimeStateNeedsRefresh(),false);
    assert.equal(await portalRuntimeStateNeedsRefresh(),false);
    assert.equal(fullReads,1);
    assert.equal(revisionReads,2);
    // Alteração externa obriga a próxima chamada a reidratar.
    remoteRevision=8;
    assert.equal(await portalRuntimeStateNeedsRefresh(),true);
    assert.deepEqual(await loadPortalRuntimeState(),{safe:'state'});
    assert.equal(await portalRuntimeStateNeedsRefresh(),false);
    assert.equal(fullReads,2);
    // Indisponibilidade do controle de versão nunca permite usar
    // silenciosamente permissões potencialmente revogadas.
    failRevision=true;
    await assert.rejects(portalRuntimeStateNeedsRefresh(),/Supabase \(503\)/);
  } finally {
    globalThis.fetch=originalFetch;
    for(const name of names){
      const value=original[name];
      if(value===undefined)delete process.env[name];else process.env[name]=value;
    }
  }
});

test('middleware valida revisão antes de carregar estado e indicadores não duplicam a carga',()=>{
  const server=readFileSync(new URL('../../server.ts',import.meta.url),'utf8');
  assert.match(server,/if\(await portalRuntimeStateNeedsRefresh\(\)\)/);
  const indicators=server.split("app.get('/api/public/indicators'")[1]?.split("app.get('/api/admin/installation-profile'")[0]||'';
  assert.match(indicators,/buildPublicIndicators\(processesStore\)/);
  assert.doesNotMatch(indicators,/loadPortalRuntimeState/);
});
