import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=(p:string)=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('configurações publicam funções independentes e removem personalização global',()=>{const c=read('src/pages/ConfiguracoesPage.tsx');const m=read('src/main.tsx');for(const label of ['Rodapé e Identidade','Integrações e Plataforma','Modelos e Documentos','E-mails','Formulários','Fluxos','Variáveis','Acesso','Registros de Assinatura','Registro de Logs'])assert.match(c,new RegExp(label));assert.doesNotMatch(c,/Personalização do Portal/);assert.doesNotMatch(c,/title: 'Sincronização'/);assert.doesNotMatch(m,/PortalUiEnhancer/);});
test('calendário pertence integralmente ao React e o runtime não remove seus nós',()=>{const r=read('src/utils/portalTableDom.ts');const h=read('src/pages/HomePage.tsx');assert.match(h,/portal-calendar-day-cell/);assert.match(h,/isWeekend = colIndex === 0 \|\| colIndex === 6/);assert.doesNotMatch(r,/enhanceCalendar|portal-core-calendar-previews|oldCounter/);});
test('tabelas usam tipografia temporal neutra e separador físico',()=>{const m=read('src/pages/MeusProcessosPage.tsx');const t=read('src/pages/PortalTutorialPage.tsx');assert.match(m,/font-normal text-black/);assert.match(t,/PortalSectionDivider/);});
