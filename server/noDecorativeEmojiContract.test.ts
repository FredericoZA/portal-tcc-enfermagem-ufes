import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const decorativeEmoji=/\p{Extended_Pictographic}/u;
const functionalMarks=/[✓✕✖]/g;

const institutionalUiFiles=[
  'src/components/TableColumnSelectorPanel.tsx',
  'src/utils/tableFormatters.ts',
  'src/utils/siteLayoutConfig.ts',
  'src/components/Sidebar.tsx',
  'src/pages/ConfiguracoesPage.tsx',
  'src/pages/HomePage.tsx',
  'src/pages/MeusProcessosPage.tsx',
  'src/pages/ProcessoDetailPage.tsx',
  'src/components/UnifiedFlowSystem.tsx',
  'src/components/UnifiedPortalEditorModal.tsx',
  'src/components/editor/PopupPreviewSection.tsx',
  'src/components/editor/SpreadsheetPreviewSection.tsx',
  'src/components/AIAnalyzerModal.tsx',
  'src/components/AuditAndSecuritySection.tsx',
  'src/components/CalendarPopupEditorModal.tsx',
  'src/components/EmergencyRecoveryModal.tsx',
  'src/components/LoginPopupEditorModal.tsx',
  'src/components/TccDetailPopupEditorModal.tsx',
  'src/utils/calendarPopupConfig.ts',
];

test('textos institucionais não usam emojis decorativos',()=>{
  const offenders=institutionalUiFiles.filter((path)=>{
    const source=read(path).replace(functionalMarks,'');
    return decorativeEmoji.test(source);
  });
  assert.deepEqual(offenders,[]);
});

test('planilhas neutralizam emojis antigos inclusive em preferências persistidas',()=>{
  const formatters=read('src/utils/tableFormatters.ts');
  const panel=read('src/components/TableColumnSelectorPanel.tsx');
  assert.match(formatters,/stripEmojis\(labels\?\.\[key\]\?\.trim\(\) \|\| fallback\)/);
  assert.match(formatters,/emoji: ''/);
  assert.match(panel,/newDefenseButtonEmoji: ''/);
  assert.match(panel,/filterConcludedEmoji: ''/);
  assert.match(panel,/cellShowEmojis: false/);
});

test('navegação usa somente ícones vetoriais como padrão',()=>{
  const layout=read('src/utils/siteLayoutConfig.ts');
  const sidebar=read('src/components/Sidebar.tsx');
  assert.match(layout,/sidebarIconMode: 'lucide'/);
  assert.match(layout,/home: ''/);
  assert.doesNotMatch(sidebar,/getNavEmoji/);
  assert.match(sidebar,/renderNavIcon/);
});

test('nomes de estudantes usam ícone vetorial e mantêm limpeza de legado',()=>{
  const students=read('src/components/StudentNames.tsx');
  assert.match(students,/IdCard/);
  assert.doesNotMatch(students,/>🪪</);
  assert.match(students,/replace\(\/🪪\/g, ''\)/);
});
