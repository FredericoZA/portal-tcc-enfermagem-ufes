import test from 'node:test';
import assert from 'node:assert/strict';
import type { ProcessData } from '../src/types';
import { publicCalendarView, publicRepositoryView } from './publicViews';

function processData(patch: Partial<ProcessData> = {}): ProcessData {
  return {
    id: 'internal-process-id',
    protocolo: 'TCC-2026-0010',
    titulo: 'Segurança do cuidado',
    etapaAtual: 'CONCLUIDO',
    status: 'CONCLUIDO',
    createdByEmail: 'aluno@aluno.ufes.br',
    aluno1: { nome: 'Ana Silva', email: 'ana@aluno.ufes.br', matricula: '20260001' },
    aluno2: null,
    orientador: { nome: 'Bruno Souza', email: 'bruno@ufes.br' },
    coorientador: null,
    banca: [{ id: 'member-internal-id', nome: 'Carla Lima', email: 'carla@ufes.br', funcao: 'EXAMINER_2' }],
    defesa: { startAt: '2026-09-15T17:00:00Z', endAt: '2026-09-15T18:30:00Z', local: 'Auditório', localStatus: 'CONFIRMADO' },
    avaliacao: { status: 'CONCLUIDO', resultadoCode: 'APROVADO', resultadoLabel: 'Aprovado', parecer: 'Parecer interno' },
    acervo: {
      trabalhoCompletoFileId: 'private-full-id',
      trabalhoCompletoFileName: 'privado.pdf',
      trabalhoCompletoFileUrl: '/api/private/full',
      trabalhoCompletoSha256: 'a'.repeat(64),
      trabalhoCompletoVersion: 2,
      resumoExpandidoFileId: 'private-abstract-id',
      resumoExpandidoFileName: 'resumo.pdf',
      resumoExpandidoFileUrl: '/api/private/abstract',
      resumoExpandidoSha256: 'b'.repeat(64),
      resumoExpandidoVersion: 1,
      publishFullWork: false,
      publishExpandedAbstract: false,
      publicationState: 'NOT_REQUESTED',
      palavrasChave: ['segurança'],
    },
    dataRevision: 4,
    createdAt: '2026-09-01T12:00:00Z',
    updatedAt: '2026-09-15T19:00:00Z',
    ...patch,
  };
}

test('calendário público não serializa acervo, avaliação ou dados pessoais sensíveis', () => {
  const view = publicCalendarView(processData({ status: 'AGUARDANDO_DEFESA', etapaAtual: 'DEFESA' }));
  const json = JSON.stringify(view);
  assert.equal(view.id, 'TCC-2026-0010');
  assert.ok(!('acervo' in view));
  assert.ok(!('avaliacao' in view));
  for (const forbidden of ['20260001', 'ana@aluno.ufes.br', 'bruno@ufes.br', 'carla@ufes.br', 'internal-process-id', 'member-internal-id', 'private-full-id']) {
    assert.ok(!json.includes(forbidden), `Calendário expôs ${forbidden}`);
  }
});

test('repositório distingue arquivo privado, público e resumo não apresentado', () => {
  const privateView = publicRepositoryView(processData());
  assert.equal(privateView.acervo.fullWorkState, 'PRIVATE');
  assert.equal(privateView.acervo.fullWorkLabel, 'Não publicado pelo autor');
  assert.equal(privateView.acervo.expandedAbstractState, 'PRIVATE');
  assert.equal(privateView.acervo.trabalhoCompletoFileUrl, undefined);
  assert.equal(privateView.acervo.resumoExpandidoFileUrl, undefined);

  const publicView = publicRepositoryView(processData({
    acervo: {
      ...processData().acervo,
      publishFullWork: true,
      publishExpandedAbstract: true,
      publicationState: 'PUBLIC',
      publicFullWorkFileId: 'public-full-id',
      publicFullWorkFileUrl: 'https://drive.google.com/public-full',
      publicExpandedAbstractFileId: 'public-abstract-id',
      publicExpandedAbstractFileUrl: 'https://drive.google.com/public-abstract',
    },
  }));
  assert.equal(publicView.acervo.fullWorkState, 'PUBLIC');
  assert.equal(publicView.acervo.expandedAbstractState, 'PUBLIC');
  assert.equal(publicView.acervo.trabalhoCompletoFileUrl, 'https://drive.google.com/public-full');
  assert.equal(publicView.acervo.resumoExpandidoFileUrl, 'https://drive.google.com/public-abstract');
  const publicJson = JSON.stringify(publicView);
  assert.ok(!publicJson.includes('private-full-id'));
  assert.ok(!publicJson.includes('public-full-id'));

  const noAbstract = publicRepositoryView(processData({ acervo: { ...processData().acervo, resumoExpandidoFileId: undefined, resumoExpandidoSha256: undefined } }));
  assert.equal(noAbstract.acervo.expandedAbstractState, 'NOT_PRESENTED');
  assert.equal(noAbstract.acervo.expandedAbstractLabel, 'Não apresentado');
});
