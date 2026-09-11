#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, lstat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import JSZip from 'jszip';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const packageJson = JSON.parse(await readFile(path.join(projectRoot, 'package.json'), 'utf8'));
const outputPath = path.resolve(process.argv[2] || path.join(projectRoot, '..', `${packageJson.name}-${packageJson.version}.zip`));
const fixedDate = new Date('2000-01-01T00:00:00.000Z');
const excludedDirectories = new Set(['.git', '.vercel', '.portal-data', 'dist', 'node_modules', 'review_inputs', 'coverage', 'test-results', 'playwright-report']);
const excludedHistoricalFiles = new Set(['CHECKLIST_ENTREGA_RC3.md', 'CHECKLIST_ENTREGA_RC4.md', 'CHECKLIST_ENTREGA_V7.md']);

function shouldExclude(relativePath, isDirectory) {
  const parts = relativePath.split(path.sep);
  if (parts.some((part) => excludedDirectories.has(part))) return true;
  const name = parts.at(-1) || '';
  if (!isDirectory && excludedHistoricalFiles.has(relativePath)) return true;
  if (!isDirectory && name.startsWith('.env') && !name.endsWith('.example')) return true;
  if (!isDirectory && (/\.zip$/i.test(name) || /\.log$/i.test(name) || name === '.DS_Store')) return true;
  return path.resolve(projectRoot, relativePath) === outputPath;
}

async function collect(directory = projectRoot, prefix = '') {
  const files = [];
  for (const entry of (await readdir(directory)).sort()) {
    const absolute = path.join(directory, entry);
    const relative = path.join(prefix, entry);
    if (excludedDirectories.has(entry)) continue;
    const info = await lstat(absolute);
    if (info.isSymbolicLink()) continue;
    if (shouldExclude(relative, info.isDirectory())) continue;
    if (info.isDirectory()) files.push(...await collect(absolute, relative));
    else if (info.isFile()) files.push({ absolute, relative: relative.split(path.sep).join('/') });
  }
  return files;
}

const files = await collect();
const zip = new JSZip();
for (const file of files) zip.file(file.relative, await readFile(file.absolute), { date: fixedDate, createFolders: false });
const archive = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 9 }, platform: 'UNIX' });
await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, archive);

const verified = await JSZip.loadAsync(await readFile(outputPath), { checkCRC32: true });
const names = Object.keys(verified.files);
if (!names.includes('package.json') || !names.includes('server.ts') || !names.some((name) => name.startsWith('supabase/migrations/'))) {
  throw new Error('O ZIP de entrega não contém a estrutura mínima esperada.');
}
for (const name of names) {
  if (name.includes('/node_modules/') || name.startsWith('node_modules/') || name.includes('/.portal-data/') || name.startsWith('.portal-data/') || /(^|\/)\.env(\.|$)/.test(name) && !name.endsWith('.example')) {
    throw new Error(`Arquivo proibido encontrado no ZIP: ${name}`);
  }
}
const sha256 = createHash('sha256').update(archive).digest('hex');
console.log(JSON.stringify({ outputPath, files: files.length, bytes: archive.length, sha256 }, null, 2));
