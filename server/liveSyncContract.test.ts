import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PORTAL_LIVE_UPDATE_EVENT, PORTAL_LIVE_POLL_INTERVAL_MS } from '../src/utils/portalLiveEvents';

const read=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('checagem remota ocorre sem recarregar página e somente com aba visível',()=>{
  const runtime=read('src/components/PortalLiveSync.tsx');
  assert.equal(PORTAL_LIVE_UPDATE_EVENT,'portal:remote-data-changed');
  assert.equal(PORTAL_LIVE_POLL_INTERVAL_MS,15000);
  assert.match(runtime,/document\.visibilityState === 'hidden'/);
  assert.match(runtime,/!navigator\.onLine/);
  assert.match(runtime,/window\.addEventListener\('focus',resumed\)/);
  assert.match(runtime,/document\.addEventListener\('visibilitychange',resumed\)/);
  assert.match(runtime,/window\.dispatchEvent\(new CustomEvent/);
  assert.doesNotMatch(runtime,/location\.reload\(/);
});

test('versão pública é opaca e não divulga IDs ou quantidades privadas',()=>{
  const src=read('server.ts');
  const integration=read('server/integrations/supabase.ts');
  assert.match(src,/app\.get\('\/api\/public\/sync\/version'/);
  assert.match(src,/app\.get\('\/api\/sync\/version',requireAuthenticated/);
  assert.match(integration,/createHmac\('sha256',supabaseSecret\(\)\)/);
  assert.match(integration,/select=revision&limit=1/);
  assert.match(src,/req\.path === '\/public\/sync\/version'/);
  assert.doesNotMatch(integration,/new EventSource|service_role.*browser/);
});

test('Meus TCCs e telas de consulta são revalidadas ao mudar o estado',()=>{
  for(const path of [
    'src/pages/MeusProcessosPage.tsx',
    'src/pages/HomePage.tsx',
    'src/pages/CoordenadorPage.tsx',
    'src/pages/IndicadoresPage.tsx',
    'src/components/NotificationBell.tsx',
  ]){
    assert.match(read(path),/PORTAL_LIVE_UPDATE_EVENT/,path);
  }
  assert.match(read('src/pages/MeusProcessosPage.tsx'),/loadProcesses\(true\)/);
  assert.match(read('src/pages/CoordenadorPage.tsx'),/loadData\(true\)/);
});

test('processo excluído deixa de permanecer aberto e falha transitória não equivale a exclusão',()=>{
  const detail=read('src/pages/ProcessoDetailPage.tsx');
  assert.match(detail,/err instanceof ApiRequestError && err\.status===404/);
  assert.match(detail,/onBackRef\.current\(\)/);
  assert.match(detail,/pode ter sido excluído ou seu acesso foi alterado/);
  assert.match(detail,/if\(!background\s*&&\s*!quiet\)setErrorMsg/);
  assert.match(detail,/if\(background && editingSectionRef\.current\)/);
  assert.match(detail,/setRemoteUpdatePending\(true\)/);
  assert.match(detail,/Descartar edição e atualizar/);
});

test('alteração tardia do título é bloqueada pela revisão esperada',()=>{
  const server=read('server.ts');
  const card=read('src/components/ProcessSummaryCard.tsx');
  assert.match(server,/req\.body\?\.expectedDataRevision!==undefined/);
  assert.match(server,/code:'STALE_DATA_REVISION'/);
  assert.match(card,/expectedDataRevision:titleBaseRevision/);
  assert.match(card,/if\(titleEditing \|\| reservationOpen\)return/);
});
