import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('download do Repositório usa o diálogo canônico do Portal', () => {
  const home = read('src/pages/HomePage.tsx');
  const dialogs = read('src/components/PortalDialogs.tsx');
  const service = read('src/services/portalDialogs.ts');

  assert.match(home, /import \{ portalConfirm \} from '\.\.\/services\/portalDialogs'/);
  assert.match(home, /handleRepositoryDownloadRequest/);
  assert.match(home, /portalConfirm\([\s\S]*title: 'Baixar dados'[\s\S]*confirmLabel: 'Baixar CSV'/);
  assert.doesNotMatch(home, /showDownloadConfirm|Confirmar Download dos Dados|Deseja baixar a planilha com todos os dados do Repositório de TCCs/);

  assert.match(dialogs, /portal-modal-surface/);
  assert.match(dialogs, /portal-modal-header/);
  assert.match(dialogs, /portal-action portal-action-primary/);
  assert.match(dialogs, /current\.title/);
  assert.match(dialogs, /current\.confirmLabel/);
  assert.match(service, /PortalDialogOptions/);
});
