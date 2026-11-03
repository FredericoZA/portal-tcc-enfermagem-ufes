import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const production = process.env.VERCEL_ENV === 'production' || process.env.PORTAL_REQUIRE_SOURCE_PARITY === 'true';
if (!production) process.exit(0);

const root = process.cwd();
const file = path.join(root,'docs','PRODUCTION_CLI_SOURCE_MANIFEST_2026-11-02.json');
if (!existsSync(file)) {
  console.error('[Portal TCC] Publicação bloqueada: inventário da fonte CLI de produção ausente.');
  process.exit(1);
}
const manifest=JSON.parse(readFileSync(file,'utf8'));
const required=Array.isArray(manifest.criticalSourcePaths)?manifest.criticalSourcePaths:[];
if (!required.length) {
  console.error('[Portal TCC] Publicação bloqueada: inventário crítico vazio.');
  process.exit(1);
}
const missing=required.filter(relativePath=>{
  if(typeof relativePath!=='string'||relativePath.includes('..')||path.isAbsolute(relativePath))return true;
  const absolute=path.resolve(root,relativePath);
  return !absolute.startsWith(root+path.sep)||!existsSync(absolute);
});
if(missing.length){
  console.error('[Portal TCC] PUBLICAÇÃO EM PRODUÇÃO BLOQUEADA.');
  console.error('[Portal TCC] A última fonte CLI contém '+missing.length+' arquivos críticos ausentes da branch.');
  console.error('[Portal TCC] Exemplos: '+missing.slice(0,12).join(', '));
  console.error('[Portal TCC] Recupere os arquivos integrais e reconcilie a fonte antes de publicar.');
  process.exit(1);
}
console.info('[Portal TCC] Inventário de arquivos da produção anterior presente. A validação de equivalência e testes de regressão continuam obrigatórios.');
