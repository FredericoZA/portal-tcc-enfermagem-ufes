import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('vincular a conta Asten independe de habilitar envio de documentos',()=>{
  const integration=read('server/integrations/asten.ts');
  const panel=read('src/components/InfrastructureIntegrationsPanel.tsx');
  const server=read('server.ts');
  assert.match(integration,/readonlyAstenServices[^;]+getIdentificador/);
  assert.match(integration,/if \(!enabled\(\) && !readonlyAstenServices\.has\(service\)\)/);
  assert.match(server,/app\.post\('\/api\/integrations\/asten\/connect',requireAuthenticated,requireAdministrator/);
  assert.match(server,/allowSignatureRetry\('cron@portal\.local','asten-cron-reconcile'\)/);
  assert.match(server,/allowSignatureRetry\(identity\.email,'asten-webhook-batch'\)/);
  assert.match(server,/allowSignatureRetry\(identity\.email,req\.params\.id\)/);
  assert.match(panel,/disabled=\{working === 'asten' \|\| !token\.trim\(\)\}/);
  assert.doesNotMatch(panel,/disabled=\{working === 'asten' \|\| !token\.trim\(\) \|\| !status\?\.asten\.enabled\}/);
  assert.match(panel,/envio permanece bloqueado até a homologação e liberação/);
});

test('Vercel mantém bloqueio de piloto e release mesmo com conta conectada',()=>{
  const conf=JSON.parse(read('vercel.json'));
  for(const flag of ['ASTEN_INTEGRATION_ENABLED','ASTEN_PILOT_APPROVED','ASTEN_PRODUCTION_RELEASE_APPROVED'])
    assert.equal(conf.env[flag],'false');
  assert.equal(conf.git.deploymentEnabled['**'],false);
  assert.equal(conf.git.deploymentEnabled.main,true);
  assert.equal(conf.crons.filter((item:{path:string})=>item.path==='/api/cron/asten-reconcile').length,1);
});
