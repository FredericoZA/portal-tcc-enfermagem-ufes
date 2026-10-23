#!/usr/bin/env node

import { access, chmod, copyFile, readFile, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { constants } from 'node:fs';
import { spawn } from 'node:child_process';

function command(name) {
  return process.platform === 'win32' ? `${name}.cmd` : name;
}

async function exists(path) {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function run(bin, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: 'inherit', env: process.env });
    child.on('error', reject);
    child.on('exit', (code, signal) => {
      if (signal) reject(new Error(`Processo encerrado por sinal ${signal}.`));
      else resolve(code ?? 1);
    });
  });
}

const major = Number(process.versions.node.split('.')[0]);
if (major !== 22) {
  console.error(`[Portal TCC] Node ${process.versions.node} detectado. Este projeto exige Node 22.x.`);
  process.exit(2);
}

if (!(await exists('.env.local'))) {
  if (!(await exists('.env.development.example'))) {
    console.error('[Portal TCC] .env.development.example não encontrado.');
    process.exit(2);
  }
  await copyFile('.env.development.example', '.env.local');
  console.log('[Portal TCC] .env.local criado automaticamente a partir do exemplo de desenvolvimento.');
} else {
  console.log('[Portal TCC] .env.local existente preservado.');
}

let localEnv = await readFile('.env.local', 'utf8');
const configLines = localEnv.split(/\r?\n/);

function rejectDuplicateEnvKeys(lines, source) {
  const seen = new Set();
  for (const line of lines) {
    const match = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/.exec(line);
    if (!match) continue;
    const name = match[1];
    if (seen.has(name)) {
      console.error('[Portal TCC] ' + source + ' repete ' + name + '. Elimine chaves duplicadas antes de iniciar o ambiente local.');
      process.exit(2);
    }
    seen.add(name);
  }
}
rejectDuplicateEnvKeys(configLines, '.env.local');

function readConfigValue(name, lines = configLines) {
  const line = lines.find((item) => new RegExp('^\\s*(?:export\\s+)?' + name + '\\s*=').test(item));
  if (!line) return '';
  const value = line.slice(line.indexOf('=') + 1).trim();
  if (value.startsWith('"')) return value.slice(1).split('"')[0];
  if (value.startsWith("'")) return value.slice(1).split("'")[0];
  return value.split('#')[0].trim();
}

// O comando local usa dados fictícios e não aceita credenciais de produção.
// Integrações externas exigem um ambiente de homologação separado e intencional.
const fallbackEnvLines = (await exists('.env')) ? (await readFile('.env', 'utf8')).split(/\r?\n/) : [];
rejectDuplicateEnvKeys(fallbackEnvLines, '.env');
// Falhar fechado: mesmo um valor vazio ou multilinha para provedores externos
// não pertence ao modo demo. A conta de homologação é configurada separadamente.
const containsExternalServices = (lines) => lines.some((line) =>
  /^\s*(?:export\s+)?(?:SUPABASE_SECRET_KEY|SUPABASE_SERVICE_ROLE_KEY|GOOGLE_OAUTH_CLIENT_SECRET|ASTEN_API_KEY)\s*=/.test(line)) ||
  (lines.some(line => /^\s*(?:export\s+)?PORTAL_PERSISTENCE_PROVIDER\s*=/.test(line)) &&
    readConfigValue('PORTAL_PERSISTENCE_PROVIDER', lines) !== 'local_file');
if (containsExternalServices(configLines) || containsExternalServices(fallbackEnvLines) ||
    (process.env.PORTAL_PERSISTENCE_PROVIDER !== undefined && process.env.PORTAL_PERSISTENCE_PROVIDER !== 'local_file') ||
    ['SUPABASE_SECRET_KEY','SUPABASE_SERVICE_ROLE_KEY','GOOGLE_OAUTH_CLIENT_SECRET','ASTEN_API_KEY'].some(key => Boolean(process.env[key]))) {
  console.error('[Portal TCC] .env.local contém configuração de provedores externos. O comando local seguro não pode usar credenciais reais. Configure um ambiente de homologação separado e execute manualmente npm run dev após avaliação técnica.');
  process.exit(2);
}

function ensureSecret(name) {
  const existing = readConfigValue(name);
  if (existing.length >= 32) return;
  const value = randomBytes(36).toString('base64url');
  const index = configLines.findIndex((line) => new RegExp('^\\s*(?:export\\s+)?' + name + '\\s*=').test(line));
  if (index >= 0) configLines[index] = name + '="' + value + '"';
  else configLines.push(name + '="' + value + '"');
  console.log('[Portal TCC] ' + name + ' gerado apenas para este ambiente local.');
}

ensureSecret('PORTAL_SESSION_SECRET');
ensureSecret('PORTAL_OTP_PEPPER');
const normalizedEnv = configLines.join('\n').replace(/\n*$/, '\n');
if (normalizedEnv !== localEnv) await writeFile('.env.local', normalizedEnv, { encoding: 'utf8', mode: 0o600 });
// writeFile(mode) não altera permissões de arquivo já copiado (ex.: 0644).
if (process.platform !== 'win32') await chmod('.env.local', 0o600);

const vitePath = process.platform === 'win32' ? 'node_modules/.bin/vite.cmd' : 'node_modules/.bin/vite';
if (!(await exists(vitePath))) {
  console.log('[Portal TCC] dependências não encontradas; executando npm ci...');
  const code = await run(command('npm'), ['ci']);
  if (code !== 0) process.exit(code);
}

console.log('[Portal TCC] ambiente local preparado.');
