import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=(p:string)=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('1.0.45 publica seis funções de configuração e remove logs laterais',()=>{const c=read('src/pages/ConfiguracoesPage.tsx');const u=read('src/components/PortalUiEnhancer.tsx');for(const label of ['Personalização do Portal','Sincronização','Acesso','Modelos e Variáveis','Registros de Assinatura','Registro de Logs'])assert.match(c,new RegExp(label));assert.doesNotMatch(u,/ensureLogsSidebarButton\(\);/);assert.doesNotMatch(u,/ensureAstenLogsSidebarButton\(\);/);});
test('calendário não remove nós React e protege navegação rápida',()=>{const r=read('src/components/PortalStructuralRuntime.tsx');assert.match(r,/grid\.isConnected/);assert.doesNotMatch(r,/if \(oldCounter\) oldCounter\.remove/);});
test('tabelas usam tipografia temporal neutra e separador físico',()=>{const m=read('src/pages/MeusProcessosPage.tsx');const t=read('src/pages/PortalTutorialPage.tsx');assert.match(m,/font-normal text-black/);assert.match(t,/PortalSectionDivider/);});
test('release atual é 1.0.45',()=>{const pkg=JSON.parse(read('package.json'));assert.equal(pkg.version,'1.0.45');});
