import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const SRC = join(ROOT, 'src');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const sourceFiles = walk(SRC).filter((path) => /\.(?:ts|tsx|css)$/.test(path));
const read = (path: string) => readFileSync(path, 'utf8');
const rel = (path: string) => relative(ROOT, path).replaceAll('\\', '/');

test('arquitetura visual não reintroduz camadas versionadas ou enhancers globais', () => {
  const forbiddenName = /portal-(?:update|version|finalization|maintenance|overrides|hotfix|surface-contract|semantic-ui|final-fixes|interaction-refinement|spreadsheet-refinement)/i;
  const offenders = sourceFiles.map(rel).filter((path) => forbiddenName.test(path));
  assert.deepEqual(offenders, []);
});

test('aplicação monta um único runtime global de planilhas', () => {
  const main = read(join(SRC, 'main.tsx'));
  assert.match(main, /PortalSpreadsheetRuntime/);
  assert.doesNotMatch(main, /PortalStructuralRuntime|PortalUiEnhancer|PortalMaintenanceEnhancer|PortalSpreadsheetEnhancer|PortalSettingsRuntime|PortalVersion\d+Enhancer/);
  const runtimeMounts = [...main.matchAll(/<Portal[A-Za-z]+Runtime\s*\/>/g)].map((match) => match[0]);
  assert.deepEqual(runtimeMounts, ['<PortalSpreadsheetRuntime />']);
});

test('nenhuma folha canônica usa !important', () => {
  const cssFiles = sourceFiles.filter((path) => path.endsWith('.css'));
  const offenders = cssFiles
    .filter((path) => read(path).includes('!important'))
    .map(rel);
  assert.deepEqual(offenders, []);
});

test('implementação não consome aliases visuais temporários', () => {
  const aliases = [
    '--portal-surface-layer-1',
    '--portal-surface-layer-2',
    '--portal-green-header',
    '--portal-green-action',
    '--portal-green-action-border',
    '--portal-popup-bg',
    '--portal-popup-header',
    '--portal-popup-header-text',
    '--portal-popup-action',
    '--portal-popup-action-text',
    '--portal-popup-border',
    '--portal-popup-radius',
    '--portal-table-header-bg',
    '--portal-table-header-text',
    '--portal-table-divider',
    '--portal-table-text',
  ];
  const tokenFile = join(SRC, 'styles', 'portal-tokens.css');
  const offenders: string[] = [];
  for (const path of sourceFiles) {
    if (path === tokenFile) continue;
    const content = read(path);
    const found = aliases.filter((alias) => content.includes(alias));
    if (found.length) offenders.push(`${rel(path)}: ${found.join(', ')}`);
  }
  assert.deepEqual(offenders, []);
});


test('renderização estrutural consome tokens em vez de duplicar HEX canônico', () => {
  const tokenFile = join(SRC, 'styles', 'portal-tokens.css');
  const structuralHex = ['#f1f5f9', '#e1e6e9', '#d5dce0', '#005830', '#337959', '#011f17', '#154d41'];
  const isVisualEditor = (path: string) => /EditorModal\.tsx$/.test(path) || path.includes('/components/editor/');
  const runtimeVisualFiles = sourceFiles.filter((path) =>
    (path.endsWith('.tsx') || path.endsWith('.css')) &&
    !isVisualEditor(rel(path))
  );
  const offenders: string[] = [];
  for (const path of runtimeVisualFiles) {
    if (path === tokenFile) continue;
    const content = read(path).toLowerCase();
    const found = structuralHex.filter((hex) => content.includes(hex));
    if (found.length) offenders.push(`${rel(path)}: ${found.join(', ')}`);
  }
  assert.deepEqual(offenders, []);
});

test('mutação global de planilhas fica concentrada no runtime canônico', () => {
  const allowed = new Set([
    'src/components/PortalSpreadsheetRuntime.tsx',
    'src/utils/portalTableDom.ts',
  ]);
  const offenders = sourceFiles
    .filter((path) => /\.(?:ts|tsx)$/.test(path))
    .filter((path) => {
      const content = read(path);
      const observesDomGlobally = /new MutationObserver\(/.test(content);
      const scansTablesGlobally = /document\.querySelector(?:All)?[^;\n]{0,140}\btable\b/.test(content);
      return (observesDomGlobally || scansTablesGlobally) && !allowed.has(rel(path));
    })
    .map(rel);
  assert.deepEqual(offenders, []);
});
