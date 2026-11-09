#!/usr/bin/env node

import { execFileSync, spawn } from 'node:child_process';

function command(name) {
  return process.platform === 'win32' ? `${name}.cmd` : name;
}

function gitCommit() {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

function run(bin, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: 'inherit', env });
    child.on('error', reject);
    child.on('exit', (code, signal) => {
      if (signal) reject(new Error(`Processo encerrado por sinal ${signal}.`));
      else resolve(code ?? 1);
    });
  });
}

if (process.env.VERCEL || (process.env.PORTAL_PERSISTENCE_PROVIDER && process.env.PORTAL_PERSISTENCE_PROVIDER !== 'local_file')) {
  console.error('[Portal TCC] Este comando exige desenvolvimento com dados locais.');
  process.exit(2);
}

const commit = gitCommit();
const baseEnv = {
  ...process.env,
  PORTAL_GIT_COMMIT: commit,
  HOST: '127.0.0.1',
  PORTAL_PERSISTENCE_PROVIDER: 'local_file',
  PORTAL_LOCAL_REVIEW_DATA: 'false',
  VITE_PORTAL_LOCAL_DEMO_AUTH: 'false',
  PORTAL_ALLOW_INSECURE_DEMO_AUTH: 'false',
  PORTAL_ALLOW_LOCAL_OTP_STORE: 'true',
  PORTAL_ALLOW_LOCAL_SECRET_STORE: 'true',
  PORTAL_TEST_DOCUMENT_RENDERER: 'false',
  PORTAL_OTP_DELIVERY_MODE: 'log'
};

const buildCode = await run(command('npm'), ['run', 'build'], baseEnv);
if (buildCode !== 0) process.exit(buildCode);

console.log(`[Portal TCC] bundle local compilado a partir de ${commit.slice(0, 7) || 'commit desconhecido'}.`);
console.log('[Portal TCC] iniciando o mesmo cliente compilado usado pela produção, com backend local de desenvolvimento.');

const serverCode = await run(
  command('npm'),
  ['exec', '--', 'tsx', 'server.ts'],
  { ...baseEnv, NODE_ENV: 'development', PORTAL_SERVE_COMPILED_CLIENT: 'true' }
);
process.exit(serverCode);
