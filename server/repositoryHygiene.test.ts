import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(process.cwd());
const source = (file: string) => readFile(path.join(root, file), 'utf8');

async function exists(file: string) {
  try {
    await access(path.join(root, file));
    return true;
  } catch {
    return false;
  }
}

test('workflows e scripts temporários de auto-correção foram removidos', async () => {
  const obsolete = [
    '.github/workflows/canonicalize-public-policy.yml',
    '.github/workflows/final-p0-contract-fix.yml',
    'scripts/canonicalize-public-policy.mjs',
    'scripts/final-p0-contract-fix.mjs',
    'scripts/finalize-canonical-cleanup.mjs'
  ];
  for (const file of obsolete) assert.equal(await exists(file), false, `${file} não deve voltar ao repositório`);
});

test('tutorial legado é somente um adaptador para a página canônica', async () => {
  const legacy = await source('src/components/OnlineSystemTutorial.tsx');
  assert.ok(legacy.includes("import { PortalTutorialPage } from '../pages/PortalTutorialPage'"));
  assert.ok(legacy.includes('<PortalTutorialPage'));
  assert.ok(!legacy.includes('PROFILE_ROWS'));
});

test('tutorial público não promete dados sensíveis nem documentos privados', async () => {
  const tutorial = await source('src/pages/PortalTutorialPage.tsx');
  assert.ok(tutorial.includes('não fazem parte do contrato público'));
  assert.ok(tutorial.includes('sincronização bem-sucedida da publicação'));
  assert.ok(!tutorial.includes('Número do TCC, nome do trabalho, nomes completos, matrícula dos alunos'));
  assert.ok(!tutorial.includes('documentos institucionais permanecem públicos'));
  assert.ok(!tutorial.includes('Acesse os documentos públicos do processo: convite, ata, autorização e declaração'));
});

test('Home pública não expõe matrícula nem fallbacks fictícios', async () => {
  const home = await source('src/pages/HomePage.tsx');
  const forbidden = [
    '2026101890',
    '2026101891',
    "'Matrícula', defensesTextFormat",
    "'Matrícula', acervoTextFormat",
    'proc.aluno1?.matricula',
    'proc.aluno2?.matricula',
    'proc.aluno1.matricula',
    'proc.aluno2.matricula'
  ];
  for (const token of forbidden) {
    assert.ok(!home.includes(token), `Home pública não pode conter ${token}`);
  }
});

test('documentação operacional aponta para a homologação vigente', async () => {
  const [checklist, nextRound, current] = await Promise.all([
    source('CHECKLIST_IMPLANTACAO.md'),
    source('PROXIMA_RODADA.md'),
    source('docs/HOMOLOGACAO_ATUAL.md')
  ]);
  assert.ok(checklist.includes('docs/HOMOLOGACAO_ATUAL.md'));
  assert.ok(nextRound.includes('docs/HOMOLOGACAO_ATUAL.md'));
  assert.ok(current.includes('resultado e parecer'));
  assert.ok(current.includes('sem nota numérica'));
  assert.ok(current.includes('homologação ponta a ponta permanece **não confirmada**'));
});
