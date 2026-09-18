import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve(process.cwd());const source=(file:string)=>readFile(path.join(root,file),'utf8');

test('Indicadores são públicos e ficam acima de Como chegar',async()=>{const [sidebar,layout,page,api]=await Promise.all([source('src/components/Sidebar.tsx'),source('src/utils/siteLayoutConfig.ts'),source('src/pages/IndicadoresPage.tsx'),source('api/public-indicators.ts')]);assert.ok(sidebar.includes("visible: true"));assert.ok(layout.includes("'DIVIDER_2', 'indicadores', 'como-chegar'"));assert.ok(page.includes('/api/public/indicators'));assert.ok(api.includes('containsPersonalData:false'));assert.ok(!page.includes('OperationsMonitorPanel'));});

test('Engrenagem reserva colunas e ordem ao Master',async()=>{const popover=await source('src/components/HeaderSettingsPopover.tsx');assert.ok(popover.includes('isMasterAdmin'));assert.ok(popover.includes('TableColumnSelectorPanel'));assert.ok(popover.includes('Colunas e ordem'));});

test('Meus TCCs e Presidência usam ações dentro da barra',async()=>{const [mine,coord]=await Promise.all([source('src/pages/MeusProcessosPage.tsx'),source('src/pages/CoordenadorPage.tsx')]);assert.equal((mine.match(/id="meus-processos-btn-novo"/g)||[]).length,1);assert.ok(mine.includes('portal-restricted-toolbar-wide'));const registerIndex=mine.indexOf('id="meus-processos-btn-novo"'),searchIndex=mine.indexOf('<SearchPopover',registerIndex),refreshIndex=mine.indexOf('title="Atualizar dados da tabela"',searchIndex);assert.ok(registerIndex>=0&&searchIndex>registerIndex&&refreshIndex>searchIndex);assert.ok(coord.includes('portal-sign-bulk-btn'));assert.ok(coord.includes('handleSignSelectedGov'));assert.ok(coord.includes('https://assinador.iti.br/'));assert.ok(coord.includes('renderSignatureActionCell'));});

test('Configuração separa personalização, sincronização e Studio simplificado',async()=>{const [config,studio,backup]=await Promise.all([source('src/pages/ConfiguracoesPage.tsx'),source('src/components/IntegrationStudioPanel.tsx'),source('src/components/AuditAndSecuritySection.tsx')]);assert.ok(config.includes('PortalPersonalizationHubModal'));assert.ok(studio.includes("{ id: 'documents', label: 'Documentos'"));assert.ok(!studio.includes("{ id: 'operation', label: 'Oficina'"));assert.ok(!studio.includes("{ id: 'audit', label: 'Auditoria'"));assert.ok(backup.includes('portal-backup-action'));});


test('regra acadêmica impede segundo TCC para o mesmo aluno',async()=>{const [server,mine]=await Promise.all([source('server.ts'),source('src/pages/MeusProcessosPage.tsx')]);assert.ok(server.includes('STUDENT_TCC_ALREADY_EXISTS'));assert.ok(server.includes('Cada aluno pode participar como autor de apenas um TCC'));assert.ok(mine.includes('const canCreateStudentTcc = roleCounts.ALUNO === 0'));assert.ok(mine.includes('canCreateStudentTcc && meusProcessosTextFormat.showCadastrarTrabalhoButton !== false'));});
