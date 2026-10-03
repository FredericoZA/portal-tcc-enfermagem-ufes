#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = (relative) => readFile(path.join(root, relative), 'utf8');

const expected = {
  '#f2f2f2': 'Superfície Nível 1',
  '#d9d9d9': 'Superfície Nível 2',
  '#b7b7b7': 'Superfície Nível 3',
  '#ffffff': 'Superfície Nível 4',
  '#006000': 'Verde estrutural',
  '#909090': 'Seleção neutra',
  '#000000': 'Texto principal',
  '#011f17': 'Sidebar/Rodapé',
  '#154c41': 'Navegação ativa',
  '#982b15': 'Filtro F01',
  '#bb271a': 'Filtro F02',
  '#da954b': 'Filtro F03',
  '#eac451': 'Filtro F04',
  '#78a65a': 'Filtro F05',
  '#54808c': 'Filtro F06',
  '#4b77d1': 'Filtro F07',
  '#5083c1': 'Filtro F08',
  '#634fa2': 'Filtro F09',
  '#9b5277': 'Filtro F10',
};

const forbiddenLegacy = ['#f1f5f9', '#e1e6e9', '#d5dce0', '#005830', '#337959', '#154d41'];

const [tokens, contract, layout, main] = await Promise.all([
  read('src/utils/portalSemanticTokens.ts'),
  read('src/portal-surface-contract.css'),
  read('src/utils/siteLayoutConfig.ts'),
  read('src/main.tsx'),
]);

const errors = [];
const authority = (tokens + '\n' + contract + '\n' + layout).toLowerCase();

for (const [hex, label] of Object.entries(expected)) {
  if (!authority.includes(hex)) errors.push(`${label}: ${hex} ausente das fontes canônicas.`);
}
for (const hex of forbiddenLegacy) {
  if (authority.includes(hex)) errors.push(`Cor estrutural legada ainda presente nas fontes canônicas: ${hex}.`);
}

const contractImport = "import './portal-surface-contract.css';";
const contractIndex = main.indexOf(contractImport);
if (contractIndex < 0) errors.push('portal-surface-contract.css não é importado por main.tsx.');
else {
  const laterCss = main.slice(contractIndex + contractImport.length).match(/import ['"].+\.css['"];/g) || [];
  if (laterCss.length) errors.push(`Contrato visual não é a última folha CSS: ${laterCss.join(', ')}`);
}

const geometry = [
  '--portal-sheet-title-height: 45px',
  '--portal-sheet-title-divider: 5px',
  '--portal-sheet-filter-height: 40px',
  '--portal-sheet-content-divider: 15px',
  '--portal-sheet-column-header-height: 35px',
  '--portal-sheet-column-control-size: 15px',
];
for (const rule of geometry) {
  if (!contract.includes(rule)) errors.push(`Geometria canônica ausente: ${rule}.`);
}

if (errors.length) {
  console.error(JSON.stringify({ status: 'REPROVADO', errors }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({
  status: 'APROVADO',
  protectedStructuralColors: 10,
  filterPaletteColors: 10,
  geometry: '45/5/40/15/35',
  authorityFiles: [
    'src/utils/portalSemanticTokens.ts',
    'src/utils/siteLayoutConfig.ts',
    'src/portal-surface-contract.css',
  ],
}, null, 2));
