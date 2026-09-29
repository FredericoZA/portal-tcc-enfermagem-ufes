#!/usr/bin/env node
import { readFile, writeFile, rm } from 'node:fs/promises';

const load = (path) => readFile(path, 'utf8');
const save = (path, content) => writeFile(path, content);
function replaceOnce(content, from, to, label) {
  if (!content.includes(from)) throw new Error(`Padrão não encontrado: ${label}`);
  return content.replace(from, to);
}

// Remove a segunda trava histórica de um TCC por aluno, localizada no endpoint de cadastro.
{
  const path = 'server.ts';
  let s = await load(path);
  const from = `    const requestedStudentEmails = [req.body?.aluno1?.email, req.body?.aluno2?.email]\n      .map((value) => normalizeEmail(String(value || '')))\n      .filter(Boolean);\n    const duplicateStudentEmail = requestedStudentEmails.find((studentEmail) => processesStore.some((process) =>\n      normalizeEmail(process.aluno1?.email || '') === studentEmail\n      || normalizeEmail(process.aluno2?.email || '') === studentEmail\n    ));\n    if (duplicateStudentEmail) {\n      return res.status(409).json({\n        error: 'Cada aluno pode participar como autor de apenas um TCC. Já existe um TCC cadastrado para um dos alunos informados.',\n        code: 'STUDENT_TCC_ALREADY_EXISTS'\n      });\n    }\n`;
  s = replaceOnce(s, from, '', 'segunda trava de TCC único');
  await save(path, s);
}

// Atualiza contratos que ainda protegiam a regra antiga de papel global/TCC único.
{
  const path = 'server/update33CompletionContract.test.ts';
  let s = await load(path);
  s = s.replace("test('acessos administrativos suportam papéis, ativação, exclusão e planilha amigável'", "test('acessos administrativos suportam ativação, exclusão e planilha amigável sem qualidade global'");
  s = s.replace("assert.ok(panel.includes('Membro da banca'));", "assert.ok(!panel.includes('Qualidade'));assert.ok(!panel.includes(\"key: 'role'\"));");
  await save(path, s);
}

{
  const path = 'scripts/test-finalization-contract.mjs';
  let s = await load(path);
  s = replaceOnce(s, `assert.match(server, /STUDENT_TCC_ALREADY_EXISTS/);`, `assert.doesNotMatch(server, /STUDENT_TCC_ALREADY_EXISTS/);`, 'contrato TCC único');
  s = replaceOnce(s, `assert.match(server, /entry\\.accessType=role/, 'O papel escolhido precisa se tornar a qualidade administrativa principal.');`, `assert.doesNotMatch(access, />Qualidade</, 'A lista de acesso não deve impor qualidade global.');`, 'contrato de qualidade global');
  s = replaceOnce(s, `assert.match(server, /replaceRole===true\\?requestedRole/, 'A troca de qualidade deve atualizar accessType no backend.');`, `assert.match(server, /synchronizeProcessParticipants/, 'Papéis acadêmicos continuam derivados dos vínculos de cada TCC.');`, 'contrato de troca de qualidade');
  await save(path, s);
}

// QA visual computado: valida os filtros no navegador, não apenas o texto do CSS.
{
  const path = 'scripts/test-visual.mjs';
  let s = await load(path);
  s = replaceOnce(
    s,
    `            const chipState = chips.map((chip) => ({\n              transform: getComputedStyle(chip).transform,\n              margin: getComputedStyle(chip).margin\n            }));`,
    `            const chipState = chips.map((chip) => ({\n              transform: getComputedStyle(chip).transform,\n              margin: getComputedStyle(chip).margin,\n              background: getComputedStyle(chip).backgroundColor,\n              selected: chip.getAttribute('aria-pressed') === 'true'\n            }));`,
    'estado computado dos filtros da Presidência',
  );
  s = replaceOnce(
    s,
    `          if (!coordinatorUi.dots.includes('rgb(34, 160, 107)') || !coordinatorUi.dots.includes('rgb(244, 180, 0)')) {\n            report.errors.push(\`master-presidencia-\${width}: filtros não exibem um verde e um amarelo (\${JSON.stringify(coordinatorUi.dots)}).\`);\n          }`,
    `          if (!coordinatorUi.dots.includes('rgb(126, 144, 126)') || !coordinatorUi.dots.includes('rgb(155, 136, 75)')) {\n            report.errors.push(\`master-presidencia-\${width}: filtros não exibem as bolinhas semânticas verde/amarela (\${JSON.stringify(coordinatorUi.dots)}).\`);\n          }\n          if (coordinatorUi.chipState.some((item) => item.background !== (item.selected ? 'rgb(174, 176, 179)' : 'rgb(255, 255, 255)'))) {\n            report.errors.push(\`master-presidencia-\${width}: fundo computado dos filtros diverge de branco/cinza (\${JSON.stringify(coordinatorUi.chipState)}).\`);\n          }`,
    'cores computadas da Presidência',
  );

  s = replaceOnce(
    s,
    `              hasRefresh: Boolean(document.querySelector('#meus-processos-refresh-btn'))\n            };`,
    `              hasRefresh: Boolean(document.querySelector('#meus-processos-refresh-btn')),\n              chips: Array.from(document.querySelectorAll('#meus-processos-page-container .portal-standard-filter-chip')).map((chip) => ({\n                background: getComputedStyle(chip).backgroundColor,\n                selected: chip.getAttribute('aria-pressed') === 'true',\n                dot: chip.querySelector('.portal-filter-dot') ? getComputedStyle(chip.querySelector('.portal-filter-dot')).backgroundColor : ''\n              }))\n            };`,
    'estado computado de Meus TCCs',
  );
  s = replaceOnce(
    s,
    `          if (!tccUi.hasRegister || !tccUi.hasSearch || !tccUi.hasRefresh) {\n            report.errors.push(\`master-meus-tccs-\${width}: ações obrigatórias do cabeçalho ausentes (\${JSON.stringify(tccUi)}).\`);\n          }`,
    `          if (!tccUi.hasRegister || !tccUi.hasSearch || !tccUi.hasRefresh) {\n            report.errors.push(\`master-meus-tccs-\${width}: ações obrigatórias do cabeçalho ausentes (\${JSON.stringify(tccUi)}).\`);\n          }\n          if (!tccUi.chips.length || tccUi.chips.some((item) => item.background !== (item.selected ? 'rgb(174, 176, 179)' : 'rgb(255, 255, 255)'))) {\n            report.errors.push(\`master-meus-tccs-\${width}: fundo computado dos filtros diverge de branco/cinza (\${JSON.stringify(tccUi.chips)}).\`);\n          }\n          if (new Set(tccUi.chips.map((item) => item.dot).filter(Boolean)).size < 4) {\n            report.errors.push(\`master-meus-tccs-\${width}: as quatro bolinhas de vínculo não preservam cores distintas (\${JSON.stringify(tccUi.chips)}).\`);\n          }`,
    'asserções visuais de Meus TCCs',
  );
  await save(path, s);
}

await rm('scripts/apply-final-green-round-2.mjs', { force: true });
console.log('Complemento da rodada final aplicado.');
