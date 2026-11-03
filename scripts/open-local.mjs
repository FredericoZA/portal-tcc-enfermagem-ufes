import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const root = fileURLToPath(new URL('..', import.meta.url));
process.chdir(root);
dotenv.config({ path: '.env.local', override: false, quiet: true });

if (process.env.NODE_ENV !== 'development' || process.env.VERCEL || (process.env.PORTAL_PERSISTENCE_PROVIDER && process.env.PORTAL_PERSISTENCE_PROVIDER !== 'local_file')) {
  console.error('Este atalho exige o ambiente de desenvolvimento com dados locais em .env.local.');
  process.exit(1);
}

const port = Number(process.env.PORT || 3000);
const url = `http://localhost:${port}`;
const openBrowser = () => {
  if (process.env.PORTAL_LOCAL_NO_OPEN === 'true') return;
  const opener = spawn('open', [url], { stdio: 'ignore' });
  opener.on('error', () => console.log(`Abra ${url} no navegador.`));
};
async function ready() {
  try {
    const response = await fetch(`${url}/api/me`, { signal: AbortSignal.timeout(1000) });
    const data = await response.json();
    return response.ok && typeof data.isAuthenticated === 'boolean' && typeof data.authenticationMode === 'string';
  } catch { return false; }
}

if (await ready()) {
  console.log(`Portal TCC já está aberto em ${url}.`);
  openBrowser();
} else {
  const child = spawn('npm', ['run', 'local'], {
    cwd: root,
    env: { ...process.env, HOST: '127.0.0.1' },
    stdio: 'inherit',
    detached: true,
  });
  let exited = false;
  let stopping = false;
  const stop = () => {
    if (stopping || exited) return;
    stopping = true;
    try { process.kill(-child.pid, 'SIGTERM'); } catch { /* already stopped */ }
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  process.on('SIGHUP', stop);
  child.on('error', (error) => {
    exited = true;
    console.error(`Não foi possível iniciar o portal: ${error.message}`);
    process.exitCode = 1;
  });
  child.on('exit', (code) => {
    exited = true;
    process.exitCode = stopping ? 0 : (code ?? 1);
  });
  let opened = false;
  for (let attempt = 0; attempt < 240 && !exited && !stopping; attempt++) {
    if (await ready()) {
      console.log(`Portal TCC disponível em ${url}.`);
      openBrowser();
      opened = true;
      break;
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  if (!opened && !exited && !stopping) {
    console.error('O portal não respondeu. Confira as mensagens acima; pressione Control + C para encerrar.');
  }
}
