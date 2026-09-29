#!/usr/bin/env node
import { readFile, writeFile, rm } from 'node:fs/promises';

const path = 'server.ts';
let source = await readFile(path, 'utf8');
const from = `    const studentEmails=[aluno1Email,aluno2?.email?normalizeEmail(aluno2.email):''].filter(Boolean);\n    // A autorização de acesso é definida pela lista administrativa. Domínio de e-mail e`;
const to = `    const studentEmails=[aluno1Email,aluno2?.email?normalizeEmail(aluno2.email):''].filter(Boolean);\n    const installationProfile=resolveInstallationProfile(currentSettings);\n    // A autorização de acesso é definida pela lista administrativa. Domínio de e-mail e`;
if (!source.includes(from)) throw new Error('Padrão não encontrado para restaurar installationProfile sem restaurar restrição de domínio.');
source = source.replace(from, to);
await writeFile(path, source);
await rm('scripts/apply-final-green-round-3.mjs', { force: true });
console.log('Perfil institucional restaurado apenas para defaults de dados; validação de domínio continua removida.');
