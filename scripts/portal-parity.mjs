#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

function git(args) {
  try {
    return execFileSync('git', args, { encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const localCommit = git(['rev-parse', 'HEAD']);
const branch = git(['branch', '--show-current']) || '(detached)';
const dirty = Boolean(git(['status', '--porcelain']));
const baseUrl = String(process.env.PORTAL_PRODUCTION_URL || 'https://portal-tcc-enfermagem-ufes.vercel.app').replace(/\/$/, '');

console.log('Portal TCC — paridade de execução');
console.log(`Local:      ${localCommit.slice(0, 7) || 'desconhecido'}  branch=${branch}  dirty=${dirty ? 'sim' : 'não'}  versão=${pkg.version}`);

let production;
try {
  const response = await fetch(`${baseUrl}/api/health`, {
    headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' },
    signal: AbortSignal.timeout(10000),
  });
  production = await response.json();
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
} catch (error) {
  console.error(`Produção:   não foi possível consultar ${baseUrl}/api/health (${error instanceof Error ? error.message : error})`);
  process.exitCode = 3;
  process.exit();
}

const productionCommit = String(production?.commit || '').trim();
console.log(`Produção:   ${productionCommit ? productionCommit.slice(0, 7) : 'commit não informado'}  status=${production?.status || 'desconhecido'}`);

if (!localCommit || !productionCommit) {
  console.log('Resultado:   NÃO CONFIRMADO — uma das versões não informou o commit.');
  process.exitCode = 2;
} else if (localCommit === productionCommit || localCommit.startsWith(productionCommit) || productionCommit.startsWith(localCommit)) {
  console.log('Resultado:   OK — local e produção apontam para o mesmo commit.');
} else {
  console.log('Resultado:   DIVERGENTE — não compare telas antes de alinhar os commits.');
  process.exitCode = 2;
}
