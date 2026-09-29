#!/usr/bin/env node
import { readFile, writeFile, rm } from 'node:fs/promises';

const load = (path) => readFile(path, 'utf8');
const save = (path, content) => writeFile(path, content);
function replaceOnce(content, from, to, label) {
  if (!content.includes(from)) throw new Error(`Padrão não encontrado: ${label}`);
  return content.replace(from, to);
}

// A interface não pode esconder o cadastro só porque a pessoa já aparece como autora em outro TCC.
{
  const path = 'src/pages/MeusProcessosPage.tsx';
  let s = await load(path);
  s = replaceOnce(
    s,
    `  const canCreateStudentTcc = roleCounts.ALUNO === 0;`,
    `  // A autorização para iniciar outro TCC vem do acesso ao Portal, não da quantidade de TCCs já vinculados.\n  const canCreateStudentTcc = true;`,
    'trava residual do botão Cadastrar TCC',
  );
  await save(path, s);
}

// Contrato antigo passa a proteger a regra atual: múltiplos TCCs são permitidos.
{
  const path = 'server/update33RestrictedAreaContract.test.ts';
  let s = await load(path);
  const from = `test('regra acadêmica impede segundo TCC para o mesmo aluno',async()=>{const [server,mine]=await Promise.all([source('server.ts'),source('src/pages/MeusProcessosPage.tsx')]);assert.ok(server.includes('STUDENT_TCC_ALREADY_EXISTS'));assert.ok(server.includes('Cada aluno pode participar como autor de apenas um TCC'));assert.ok(mine.includes('const canCreateStudentTcc = roleCounts.ALUNO === 0'));assert.ok(mine.includes('canCreateStudentTcc && meusProcessosTextFormat.showCadastrarTrabalhoButton !== false'));});`;
  const to = `test('acesso permite novo TCC mesmo quando a pessoa já participa de outro',async()=>{const [server,mine]=await Promise.all([source('server.ts'),source('src/pages/MeusProcessosPage.tsx')]);assert.ok(!server.includes('STUDENT_TCC_ALREADY_EXISTS'));assert.ok(!server.includes('Cada aluno pode participar como autor de apenas um TCC'));assert.ok(mine.includes('const canCreateStudentTcc = true'));assert.ok(mine.includes('canCreateStudentTcc && meusProcessosTextFormat.showCadastrarTrabalhoButton !== false'));});`;
  s = replaceOnce(s, from, to, 'contrato antigo de TCC único');
  await save(path, s);
}

// O contrato estrutural deve acompanhar a release realmente produzida.
{
  const path = 'server/version1046StructuralContract.test.ts';
  let s = await load(path);
  s = replaceOnce(s,
    `test('release atual é 1.0.47', () => {\n  assert.equal(JSON.parse(read('package.json')).version, '1.0.47');\n});`,
    `test('release atual é 1.0.48', () => {\n  assert.equal(JSON.parse(read('package.json')).version, '1.0.48');\n});`,
    'contrato da versão atual',
  );
  await save(path, s);
}

await rm('scripts/apply-final-green-round-4.mjs', { force: true });
console.log('Trava residual de múltiplos TCCs removida e contratos históricos alinhados.');
