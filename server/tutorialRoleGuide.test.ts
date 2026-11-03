import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {PortalIllustratedGuide, activitiesForRole, guideActivities, guideActivityOrder} from '../src/components/PortalIllustratedGuide';
import {readFileSync, existsSync} from 'node:fs';

const guide = (role: string) => renderToStaticMarkup(React.createElement(PortalIllustratedGuide, {role}));
const content = (role: string) => activitiesForRole(role).flatMap(activity => [...activity.steps, activity.done, ...activity.help]).join('\n');

test('visitante consulta sem receber tarefas de avaliação, devolução ou autenticação obrigatória', () => {
  const html = guide('visitante');
  assert.match(html, /Calendário/);
  assert.match(html, /Repositório/);
  assert.doesNotMatch(html, /Registrar o conceito e conferir|Assinar e devolver pelo Gov|seis dígitos|\/manual\/ficha/);
  assert.match(content('visitante'), /Não é necessário entrar/);
  assert.match(content('visitante'), /E-mails, matrículas e registros não aparecem/);
});

test('manual possui apenas os três perfis solicitados; perfil desconhecido não recebe tarefas', () => {
  assert.deepEqual(Object.keys(guideActivityOrder), ['aluno', 'orientador', 'visitante']);
  assert.equal(guide('presidente'), '');
  assert.deepEqual(activitiesForRole('__proto__'), []);
  const source = readFileSync(new URL('../src/pages/PortalTutorialPage.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /presidente:|Presidente da Comissão/);
});

test('aluno e orientador recebem somente as atividades correspondentes', () => {
  const student = guide('aluno'), advisor = guide('orientador');
  assert.match(student, /Acompanhar a confirmação da reserva/);
  assert.match(student, /Entregar os arquivos/);
  assert.doesNotMatch(student, /Registrar o conceito e conferir/);
  assert.match(advisor, /Registrar o conceito e conferir/);
  assert.doesNotMatch(advisor, /Entregar os arquivos e escolher/);
});

test('atividades têm instruções, condição de conclusão, ajuda contextual e imagem existente', () => {
  assert.equal(new Set(guideActivities.map(activity => activity.id)).size, guideActivities.length);
  for (const activity of guideActivities) {
    assert.ok(activity.steps.length >= 3, activity.id);
    assert.ok(activity.done && activity.help.length && activity.imageCaption, activity.id);
    const file = new URL(`../public/manual/${activity.imageId}.jpg`, import.meta.url);
    assert.ok(existsSync(file), `${activity.id}: imagem ausente`);
    const bytes = readFileSync(file);
    assert.equal(bytes.subarray(0, 3).toString('hex'), 'ffd8ff', `${activity.id}: JPEG inválido`);
    for (const related of activity.relatedImages || []) {
      assert.ok(existsSync(new URL(`../public/manual/${related.id}.jpg`, import.meta.url)), `${related.id}: imagem complementar ausente`);
    }
  }
});

test('fichário tem painel acessível, navegação por atividade e imagens ampliáveis também no celular', () => {
  for (const role of Object.keys(guideActivityOrder)) {
    const html = guide(role);
    assert.equal((html.match(/role="tab"/g) || []).length, activitiesForRole(role).length);
    assert.match(html, /role="tabpanel"/);
    assert.match(html, /aria-controls="guide-panel-/);
    assert.match(html, /Abrir imagem em tamanho maior/);
    assert.match(html, /Como saber que terminou/);
    assert.match(html, /Algo deu errado/);
    assert.match(html, /w-full object-contain/);
    assert.doesNotMatch(html, /w-1\/4|w-1\/2/);
  }
});

test('guia de cliques fica somente em Como usar e o quadro de assinaturas não se repete no fluxo', () => {
  const read = (path: string) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
  assert.match(read('src/pages/PortalTutorialPage.tsx'), /<PortalIllustratedGuide role=\{role\}/);
  const flow = read('src/pages/FluxoTccPage.tsx');
  assert.doesNotMatch(flow, /PortalIllustratedGuide/);
  assert.equal((flow.match(/<SignatureFlowSummary\s*\/>/g) || []).length, 1);
});

test('conceito, entrega e assinatura respeitam os caminhos e as condições reais', () => {
  const advisor = content('orientador'), student = content('aluno');
  assert.match(advisor, /Conceito e Ata/);
  assert.match(advisor, /Aprovado, Aprovado com ressalva ou Reprovado/);
  assert.match(advisor, /Portal do Professor/);
  assert.match(advisor, /não envia uma assinatura automaticamente/);
  assert.match(advisor, /Master confere/);
  assert.match(advisor, /primeira entrega final bloqueia a reabertura/);
  assert.match(student, /exatamente cinco palavras-chave/);
  assert.match(student, /não autoriza sua publicação/);
  assert.match(student, /Sem nenhuma autorização, não haverá termo/);
  assert.match(student, /Confirmar entrega e ir para documentos/);
  assert.match(student, /Enviar nova solicitação/);
  assert.match(student, /sem os botões reservados ao responsável/);
});

test('legados são históricos no mesmo repositório, com privacidade preservada', () => {
  const text = content('visitante');
  assert.match(text, /001 - Legado/);
  assert.match(text, /mesmas abas/);
  assert.match(text, /documentação administrativa antiga permanece privada/);
  assert.match(text, /autorização confirmada/);
  assert.match(text, /não inicia outro cadastro, defesa ou assinatura/);
});
