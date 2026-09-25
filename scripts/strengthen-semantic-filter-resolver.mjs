import fs from 'node:fs';

const path = 'src/utils/tableFormatters.ts';
let source = fs.readFileSync(path, 'utf8');

const oldLine = '  const semanticTone = resolvePortalFilterTone(key);';
const newBlock = `  const semanticTone =
    resolvePortalFilterTone(key) ||
    resolvePortalFilterTone(itemConfig.key || '') ||
    resolvePortalFilterTone(label) ||
    resolvePortalFilterTone(fallbackLabel || '');`;

if (source.includes(newBlock)) {
  console.log('Resolvedor semântico global já fortalecido.');
  process.exit(0);
}
if (!source.includes(oldLine)) {
  throw new Error('Ponto de resolução semântica não localizado.');
}

source = source.replace(oldLine, newBlock);
fs.writeFileSync(path, source);
console.log('Filtros passam a resolver semântica por chave e rótulo globalmente.');
