import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('downloads do calendário e do repositório usam o mesmo painel de exportação', () => {
  const home = read('src/pages/HomePage.tsx');
  const panel = read('src/components/TableExportPopover.tsx');

  assert.match(home, /<TableExportPopover\b[^]*?triggerLabel="Baixar lista de defesas"/);
  assert.match(home, /<TableExportPopover\b[^]*?triggerLabel="Baixar lista do repositório"[^]*?getSnapshot=\{getRepositoryExportSnapshot\}/);
  assert.doesNotMatch(home, /handleRepositoryDownloadRequest|showRepositoryDocuments|portal-repository-documents-jump/);

  assert.match(panel, /portal-table-settings-popover portal-modal-surface portal-table-export-popover/);
  assert.match(panel, /Data de início/);
  assert.match(panel, /Data de fim/);
  assert.match(panel, /Colunas e ordem/);
  for (const label of ['Excel', 'CSV', 'PDF']) assert.ok(panel.includes(`label: '${label}'`));
});
