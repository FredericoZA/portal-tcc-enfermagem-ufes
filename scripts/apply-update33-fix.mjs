import fs from 'node:fs';

const file='src/pages/MeusProcessosPage.tsx';
let source=fs.readFileSync(file,'utf8');
source=source.replace('{/* Top Action Bar - Button Above Header */}','/* Top Action Bar - Button Above Header */');
source=source.replace('{/* Section with Unified Gray Header & Table */}','/* Section with Unified Gray Header & Table */');
fs.writeFileSync(file,source);

await import('./apply-update33.mjs');
