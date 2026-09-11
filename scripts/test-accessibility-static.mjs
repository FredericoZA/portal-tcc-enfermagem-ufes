import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('../src/', import.meta.url).pathname;
const files = [];
const walk = (directory) => {
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) walk(path);
    else if (/\.tsx?$/.test(path)) files.push(path);
  }
};
walk(root);

const issues = [];
for (const file of files) {
  const source = readFileSync(file, 'utf8');
  for (const match of source.matchAll(/<img\b([^>]*)>/g)) {
    if (!/\balt\s*=/.test(match[1])) issues.push(`${file}: imagem sem alt`);
  }
  for (const match of source.matchAll(/<button\b([^>]*)>(\s*<[^>]+>\s*)<\/button>/g)) {
    if (!/aria-label\s*=|title\s*=/.test(match[1])) {
      const line = source.slice(0, match.index).split('\n').length;
      issues.push(`${file}:${line}: botão apenas com ícone sem nome acessível`);
    }
  }
}

if (issues.length) {
  console.error(issues.slice(0, 50).join('\n'));
  process.exit(1);
}
console.log(`Acessibilidade estática: ${files.length} arquivo(s) verificado(s).`);
