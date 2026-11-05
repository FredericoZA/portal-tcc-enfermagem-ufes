#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, lstat, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import JSZip from 'jszip';

const fixedDate = new Date('2000-01-01T00:00:00.000Z');
const excludedDirectories = new Set([
  '.git', '.vercel', '.portal-data', '.supabase', '.supabase-temp', '.temp',
  '.playwright-cli', '.playwright-mcp', 'dist', 'build', 'node_modules',
  'review_inputs', 'coverage', 'test-results', 'playwright-report', 'output', 'tmp',
]);
const excludedHistoricalFiles = new Set(['CHECKLIST_ENTREGA_RC3.md', 'CHECKLIST_ENTREGA_RC4.md', 'CHECKLIST_ENTREGA_V7.md']);

export function shouldExcludeReleasePath(relativePath, isDirectory = false) {
  const parts = relativePath.split(/[\\/]+/);
  if (parts.some((part) => excludedDirectories.has(part))) return true;
  const name = parts.at(-1) || '';
  if (!isDirectory && excludedHistoricalFiles.has(relativePath)) return true;
  if (!isDirectory && name.startsWith('.env') && !name.endsWith('.example')) return true;
  if (!isDirectory && (
    /\.(?:zip|log|pem|key|p12|pfx|keystore)$/i.test(name)
    || /^(?:credentials.*|client_secret.*|service[-_]account.*)\.json$/i.test(name)
    || name === '.DS_Store' || name === '.npmrc'
  )) return true;
  return false;
}

async function collect(projectRoot, outputPath, directory = projectRoot, prefix = '') {
  const files = [];
  for (const entry of (await readdir(directory)).sort()) {
    const absolute = path.join(directory, entry);
    const relative = path.join(prefix, entry);
    if (excludedDirectories.has(entry)) continue;
    const info = await lstat(absolute);
    if (info.isSymbolicLink()) continue;
    if (shouldExcludeReleasePath(relative, info.isDirectory()) || absolute === outputPath) continue;
    if (info.isDirectory()) files.push(...await collect(projectRoot, outputPath, absolute, relative));
    else if (info.isFile()) files.push({ absolute, relative: relative.split(path.sep).join('/') });
  }
  return files;
}

export async function packageRelease(projectRoot, outputPath) {
  projectRoot = path.resolve(projectRoot);
  outputPath = path.resolve(outputPath);
  const files = await collect(projectRoot, outputPath);
  const zip = new JSZip();
  for (const file of files) zip.file(file.relative, await readFile(file.absolute), { date: fixedDate, createFolders: false });
  const archive = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 9 }, platform: 'UNIX' });

  const verified = await JSZip.loadAsync(archive, { checkCRC32: true });
  const names = Object.keys(verified.files);
  if (!names.includes('package.json') || !names.includes('server.ts') || !names.some((name) => name.startsWith('supabase/migrations/'))) {
    throw new Error('O ZIP de entrega não contém a estrutura mínima esperada.');
  }
  for (const name of names) {
    if (shouldExcludeReleasePath(name, verified.files[name].dir)) throw new Error(`Arquivo proibido encontrado no ZIP: ${name}`);
  }
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, archive);
  const written = await readFile(outputPath);
  if (!written.equals(archive)) throw new Error('O ZIP gravado diverge do conteúdo verificado.');
  const sha256 = createHash('sha256').update(archive).digest('hex');
  return { outputPath, files: files.length, bytes: archive.length, sha256 };
}

if (process.argv[1] && await realpath(process.argv[1]).catch(() => '') === fileURLToPath(import.meta.url)) {
  const projectRoot = fileURLToPath(new URL('..', import.meta.url));
  const packageJson = JSON.parse(await readFile(path.join(projectRoot, 'package.json'), 'utf8'));
  const outputPath = path.resolve(process.argv[2] || path.join(projectRoot, '..', `${packageJson.name}-${packageJson.version}.zip`));
  console.log(JSON.stringify(await packageRelease(projectRoot, outputPath), null, 2));
}
