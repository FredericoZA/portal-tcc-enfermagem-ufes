#!/usr/bin/env node
import { readFile, writeFile, rm } from 'node:fs/promises';

const path = 'scripts/test-secure-flow.mjs';
let s = await readFile(path, 'utf8');
function replaceOnce(from, to, label) {
  if (!s.includes(from)) throw new Error(`Padrão não encontrado: ${label}`);
  s = s.replace(from, to);
}

replaceOnce(
`  await check('limite de autoria não bloqueia outras participações', () => {\n    includesEvery(server, [\n      'Cada aluno pode autuar apenas um TCC',\n      'process.aluno1.email',\n      'process.aluno2?.email',\n      "'EXAMINER'",\n      "role:'CO_ADVISOR'"\n    ]);\n    assert.ok(!/membershipsStore[^;]{0,400}Cada aluno pode autuar/.test(server), 'o limite de TCC parece usar memberships em vez de somente autores');\n  });`,
`  await check('autoria em múltiplos TCCs não reduz os demais vínculos por processo', () => {\n    assert.ok(!server.includes('Cada aluno pode autuar apenas um TCC'));\n    assert.ok(!server.includes('Cada aluno pode participar como autor de apenas um TCC'));\n    assert.ok(!server.includes('STUDENT_TCC_ALREADY_EXISTS'));\n    includesEvery(server, [\n      'process.aluno1.email',\n      'process.aluno2?.email',\n      "'EXAMINER'",\n      "role:'CO_ADVISOR'",\n      'synchronizeProcessParticipants'\n    ]);\n  });`,
'checagem estática de múltiplos TCCs');

replaceOnce(
`    await check('runtime: um TCC por autor e participação ilimitada em outro', async () => {`,
`    await check('runtime: o mesmo autor pode cadastrar mais de um TCC e manter papéis por processo', async () => {`,
'nome da checagem runtime');

replaceOnce(
`      const duplicate = await request('/api/processes', { method: 'POST', headers: asUser(master), body: JSON.stringify({ ...payload, titulo: 'Segundo TCC proibido' }) });\n      assert.equal(duplicate.response.status, 409, JSON.stringify(duplicate.body));`,
`      const secondProcessPayload = {\n        ...payload,\n        titulo: 'Segundo TCC permitido para o mesmo autor',\n        defesa: { ...payload.defesa, startAt: '2026-12-11T14:00:00.000Z' }\n      };\n      const duplicate = await request('/api/processes', { method: 'POST', headers: asUser(master), body: JSON.stringify(secondProcessPayload) });\n      assert.ok([201,202].includes(duplicate.response.status), JSON.stringify(duplicate.body));\n      assert.notEqual(duplicate.body?.id, created.body?.id);`,
'checagem runtime de segundo TCC');

await writeFile(path, s);
await rm('scripts/apply-final-green-round-5.mjs', { force: true });
console.log('Fluxo seguro atualizado para validar múltiplos TCCs sem perder isolamento de papéis.');
