#!/usr/bin/env node

import { execFileSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const root = fileURLToPath(new URL('..', import.meta.url));
process.chdir(root);
dotenv.config({ path: '.env.local', override: false, quiet: true });
if (process.env.NODE_ENV !== 'development' || process.env.VERCEL ||
    (process.env.PORTAL_PERSISTENCE_PROVIDER && process.env.PORTAL_PERSISTENCE_PROVIDER !== 'local_file')) {
  console.error('[Portal TCC] Este comando exige desenvolvimento com dados locais.');
  process.exit(2);
}

const commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
console.log(`[Portal TCC] Desenvolvimento local: http://localhost:${process.env.PORT || 3000}`);
console.log('[Portal TCC] Salvar a interface atualiza o navegador; salvar o servidor reinicia a API.');
const child = spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', [
  'exec', '--', 'tsx', 'watch', '--ignore', '.portal-data/**', '--ignore', 'dist/**', 'server.ts',
], {
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: 'development',
    HOST: '127.0.0.1',
    DISABLE_HMR: 'false',
    PORTAL_PERSISTENCE_PROVIDER: 'local_file',
    PORTAL_LOCAL_REVIEW_DATA: process.env.PORTAL_LOCAL_REVIEW_DATA || 'true',
    PORTAL_GIT_COMMIT: commit,
    PORTAL_SERVE_COMPILED_CLIENT: 'false',
    VITE_PORTAL_LOCAL_DEMO_AUTH: 'true',
  },
});
child.on('error', error => {
  console.error(`[Portal TCC] Falha ao iniciar: ${error.message}`);
  process.exitCode = 1;
});
child.on('exit', (code, signal) => {
  process.exitCode = signal ? 0 : (code ?? 1);
});
