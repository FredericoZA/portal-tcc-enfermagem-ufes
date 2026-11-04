import test from 'node:test';
import assert from 'node:assert/strict';
import { formatDateExtensoTotal, formatDateNumeric, formatDatePt, formatWeekdayPt, formatDateWithWeekday, formatDateNumericWithWeekday, formatDateExtensoWithWeekday, formatTimeExtenso, getProcessProgress, getWorkflowStagesCount, getStepNumberLabel } from '../src/utils/formatters';

test('formatadores preservam valores civis informados no horário institucional', () => {
  assert.equal(formatDatePt('2026-09-11T14:30:00'), '11 de setembro de 2026');
  assert.equal(formatDateNumeric('2026-09-11T14:30:00'), '11/09/2026');
  assert.equal(formatDateExtensoTotal('2026-09-11T14:30:00'), 'onze de setembro de dois mil e vinte e seis');
  assert.equal(formatTimeExtenso('2026-09-11T14:30:00'), 'quatorze horas e trinta minutos');
});

test('timestamps absolutos são convertidos para America/Sao_Paulo antes de gerar documento', () => {
  assert.equal(formatDatePt('2026-09-12T01:30:00.000Z'), '11 de setembro de 2026');
  assert.equal(formatTimeExtenso('2026-09-12T01:30:00.000Z'), 'vinte e duas horas e trinta minutos');
});

test('data por extenso não fica limitada aos anos originalmente codificados', () => {
  assert.equal(formatDateExtensoTotal('2028-01-01'), 'primeiro de janeiro de dois mil e vinte e oito');
  assert.equal(formatTimeExtenso('01:01'), 'uma hora e um minuto');
  assert.equal(formatTimeExtenso('14:00'), 'quatorze horas');
});

test('valores inválidos permanecem visíveis em vez de serem silenciosamente alterados', () => {
  assert.equal(formatDatePt('data-a-confirmar'), 'data-a-confirmar');
  assert.equal(formatTimeExtenso('hora-a-confirmar'), 'hora-a-confirmar');
});


test('ata arquivada avança para dados finais e repositório sem voltar à inscrição',()=>{
  const pending=getProcessProgress({status:'AGUARDANDO_ASSINATURA',etapaAtual:'ASSINATURA'},7);
  const after=getProcessProgress({status:'AGUARDANDO_DADOS_FINAIS',etapaAtual:'REPOSITORIO'},7);
  assert.equal(after.label,'Etapa 7/7: Dados finais e repositório');
  assert.ok(after.percent>=pending.percent&&after.percent<100);
  assert.equal(getProcessProgress({status:'CONCLUIDO',etapaAtual:'CONCLUIDO'},7).percent,100);
});

test('progresso acompanha a quantidade de etapas configurada sem fixar o papel do signatário', () => {
  let saved = JSON.stringify(Array.from({ length: 7 }, (_, index) => ({ id: `stage-${index + 1}` })));
  const storage = { getItem: () => saved };
  const awaitingSignatures = { status: 'AGUARDANDO_ASSINATURA', etapaAtual: 'ASSINATURA' } as const;
  const first = getProcessProgress(awaitingSignatures, getWorkflowStagesCount(storage));
  assert.equal(first.label, 'Etapa 7/7: Aguardando Assinaturas');
  assert.equal(first.percent, 93);
  assert.equal(getStepNumberLabel(first.label), 'Fase 7');

  saved = JSON.stringify(Array.from({ length: 8 }, (_, index) => ({ id: `stage-${index + 1}` })));
  const second = getProcessProgress(awaitingSignatures, getWorkflowStagesCount(storage));
  assert.equal(second.label, 'Etapa 8/8: Aguardando Assinaturas');
  assert.equal(second.percent, 94);
  assert.equal(getStepNumberLabel(second.label), 'Fase 8');
});

test('preferência de etapas ausente, inválida ou bloqueada preserva a renderização do processo', () => {
  for (const saved of [null, '', '{invalid', '[]', '{}', 'null', '5']) {
    assert.equal(getWorkflowStagesCount({ getItem: () => saved }), 5);
  }
  assert.equal(getWorkflowStagesCount({ getItem: () => { throw new Error('Storage blocked'); } }), 5);
  const fallback = getProcessProgress({ status: 'AGUARDANDO_DADOS_FINAIS', etapaAtual: 'REPOSITORIO' });
  assert.equal(fallback.label, 'Etapa 5/5: Dados finais e repositório');
  assert.equal(fallback.percent, 90);
});

test('ordenação por progresso acompanha a sequência do fluxo e só termina após conclusão', () => {
  const states = [
    { status: 'EM_RASCUNHO', etapaAtual: 'CONFIRMACAO_LOCAL' },
    { status: 'AGUARDANDO_CONFIRMACAO_LOCAL', etapaAtual: 'CADASTRO' },
    { status: 'AGUARDANDO_DEFESA', etapaAtual: 'DEFESA' },
    { status: 'EM_AVALIACAO', etapaAtual: 'AVALIACAO' },
    { status: 'AGUARDANDO_ASSINATURA', etapaAtual: 'ASSINATURA' },
    { status: 'AGUARDANDO_DADOS_FINAIS', etapaAtual: 'REPOSITORIO' },
    { status: 'CONCLUIDO', etapaAtual: 'CONCLUIDO' }
  ] as const;
  const progress = states.map((state) => getProcessProgress(state, 7));
  assert.deepEqual(progress.map((entry) => entry.percent), [14, 29, 71, 86, 93, 93, 100]);
  assert.ok(progress.slice(0, -1).every((entry) => entry.percent < 100));
});

test('07/12/2026 aparece como segunda-feira em e-mails, comprovantes e telas', () => {
  assert.equal(formatWeekdayPt('2026-12-07'),'segunda-feira');
  assert.equal(formatDateWithWeekday('2026-12-07'),'segunda-feira, 7 de dezembro de 2026');
  assert.equal(formatDateNumericWithWeekday('2026-12-07'),'segunda-feira, 07/12/2026');
  assert.equal(formatDateExtensoWithWeekday('2026-12-07'),'segunda-feira, sete de dezembro de dois mil e vinte e seis');
});

test('o fuso institucional preserva a data civil ao atravessar a meia-noite UTC', () => {
  assert.equal(formatDateWithWeekday('2026-09-12T01:30:00.000Z'),'sexta-feira, 11 de setembro de 2026');
  assert.equal(formatDateNumericWithWeekday('2026-09-12T01:30:00.000Z'),'sexta-feira, 11/09/2026');
  assert.equal(formatWeekdayPt('2026-09-12T01:30:00.000Z'),'sexta-feira');
});

test('sábado, domingo, ano novo e datas inválidas são tratados sem alterar os dados', () => {
  assert.equal(formatDateWithWeekday('2026-11-07'),'sábado, 7 de novembro de 2026');
  assert.equal(formatDateWithWeekday('2026-11-08'),'domingo, 8 de novembro de 2026');
  assert.equal(formatDateNumericWithWeekday('data-a-confirmar'),'data-a-confirmar');
  assert.equal(formatWeekdayPt('2026-02-31'),'');
  assert.equal(formatDateNumeric('2026-12-07'),'07/12/2026');
});
