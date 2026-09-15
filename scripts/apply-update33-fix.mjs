import fs from 'node:fs';

for (const [file, replacements] of Object.entries({
  'src/pages/MeusProcessosPage.tsx': [
    ['{/* Top Action Bar - Button Above Header */}','/* Top Action Bar - Button Above Header */'],
    ['{/* Section with Unified Gray Header & Table */}','/* Section with Unified Gray Header & Table */'],
  ],
  'src/pages/CoordenadorPage.tsx': [
    ['{/* Botões no Topo (Acima do Cabeçalho) */}','/* Botões no Topo (Acima do Cabeçalho) */'],
  ],
})) {
  let source=fs.readFileSync(file,'utf8');
  for (const [from,to] of replacements) source=source.replace(from,to);
  fs.writeFileSync(file,source);
}

await import('./apply-update33.mjs');
