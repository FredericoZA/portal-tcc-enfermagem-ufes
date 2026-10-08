#!/usr/bin/env node

import { access, copyFile } from 'node:fs/promises';
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

const vitePath = process.platform === 'win32' ? 'node_modules/.bin/vite.cmd' : 'node_modules/.bin/vite';
if (!(await exists(vitePath))) {
  console.log('[Portal TCC] dependências não encontradas; executando npm ci...');
  const code = await run(command('npm'), ['ci']);
  if (code !== 0) process.exit(code);
}

console.log('[Portal TCC] ambiente local preparado.');
