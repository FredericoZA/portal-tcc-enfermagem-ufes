import test from 'node:test';
import assert from 'node:assert/strict';
import { DEMO_PROCESSES, INITIAL_SETTINGS } from '../src/services/demoSeed';
import { acceptEvaluation, EvaluationError } from './workflow/evaluation';
import { evaluationQuestions, standardEvaluationOpinion, acceptEvaluationAnswers } from '../src/utils/evaluationForm';
import { buildProcessVariables } from './workflow/runtime';
import { normalizeUnifiedAppearance } from '../src/utils/unifiedAppearance';
import { portalFontFamily } from '../src/utils/portalFonts';

const process = structuredClone(DEMO_PROCESSES[0]);
const settings = structuredClone(INITIAL_SETTINGS);
const now = new Date('2026-09-09T16:00:00Z');
const valid = { resultadoCode: 'APROVADO', parecer: 'Parecer registrado pelo orientador.', dataConfirmed: true,
  expectedDataRevision: process.dataRevision, expectedSchemaRevision: settings.integrationStudio?.revision || 0 };
const accept = (patch: Record<string, unknown> = {}) => acceptEvaluation(process, { ...valid, ...patch }, settings, process.orientador.email, now);

test('três pareceres personalizados por título, sem IA ou fatos acadêmicos inventados',()=>{
  assert.equal(standardEvaluationOpinion(process),'');
  const expected=[
    {code:'APROVADO',label:'Aprovado',snippet:'Fundamentação da decisão:'},
    {code:'APROVADO_COM_RESSALVA',label:'Aprovado com ressalva',snippet:'Correções e encaminhamentos:'},
    {code:'REPROVADO',label:'Reprovado',snippet:'Fundamentação da decisão:'},
  ];
  for (const outcome of expected){
    const draft=standardEvaluationOpinion(process,outcome);
    assert.equal(draft,standardEvaluationOpinion(process,outcome));
    assert.ok(draft.includes(process.titulo));
    assert.ok(draft.includes(outcome.label));
    assert.ok(draft.includes(outcome.snippet));
    assert.match(draft,/\[Completar com/);
    assert.doesNotMatch(draft,/clareza|organização|domínio do tema|qualidade do trabalho|nota numérica/i);
    assert.ok(!draft.includes(process.aluno1.email));
    assert.ok(!draft.includes(process.aluno1.matricula));
    assert.throws(()=>acceptEvaluationAnswers({resultadoCode:outcome.code,parecer:draft},[outcome]),/Complete a fundamentação/);
  }
  const approved=standardEvaluationOpinion(process,expected[0]);
  const reviewed=approved.replace('[Completar com os fundamentos efetivamente deliberados pela banca durante a defesa]','Conforme os fundamentos documentados e registrados na sessão de defesa');
  assert.equal(acceptEvaluationAnswers({resultadoCode:'APROVADO',parecer:reviewed},[expected[0]]).parecer,reviewed);
  assert.throws(()=>acceptEvaluationAnswers({resultadoCode:'APROVADO',parecer:approved.replace('[Completar','[completar')},[expected[0]]),/Complete a fundamentação/);
});

test('título excepcional não é cortado nem expõe dados adicionais no texto-base',()=>{
  const longTitle='Assunto'.repeat(50);
  const processWithLongTitle={...process,titulo:longTitle};
  const text=standardEvaluationOpinion(processWithLongTitle,{code:'APROVADO',label:'Aprovado'});
  assert.ok(!text.includes(longTitle));
  assert.ok(text.includes('Trabalho de Conclusão de Curso'));
  assert.equal(standardEvaluationOpinion(process,{code:'NAO_PREVISTO',label:'Resultado desconhecido'}),'');
});

test('avaliação aceita resultado e parecer sem nota numérica e preserva a conferência', () => {
  const result = accept({ notaFinal: '9,25', answers: { NOTA_FINAL: 9.25 } });
  assert.equal(result.resultadoLabel, 'Aprovado');
  assert.equal((result as any).notaFinal, undefined);
  assert.equal(result.answers.NOTA_FINAL, undefined);
  assert.equal(result.dataReview.confirmedBy, process.orientador.email);
  assert.equal(result.dataReview.sourceDataRevision, process.dataRevision);
  assert.ok(result.dataReview.fields.some(([, value]) => value.includes(process.aluno1.matricula)));
});

test('avaliação recusa ausência de conferência, resultado inválido e parecer incorreto', () => {
  for (const patch of [{ dataConfirmed: false }, { parecer: '' }, { parecer: 123 }, { resultadoCode: 'INVENTADO' }]) assert.throws(() => accept(patch), EvaluationError, JSON.stringify(patch));
});

test('avaliação recusa revisões desatualizadas e apresentação ainda não iniciada', () => {
  assert.throws(() => accept({ expectedDataRevision: process.dataRevision - 1 }), (e: EvaluationError) => e.code === 'STALE_DATA_REVIEW');
  assert.throws(() => accept({ expectedSchemaRevision: 999 }), (e: EvaluationError) => e.code === 'STALE_EVALUATION_FORM');
  assert.throws(() => acceptEvaluation(process, valid, settings, process.orientador.email, new Date('2026-01-01')), (e: EvaluationError) => e.code === 'DEFENSE_NOT_STARTED');
});

test('configuração antiga não consegue reintroduzir nota na avaliação', () => {
  const fields = evaluationQuestions({ formTemplates: [{ id: 'form-parecer-banca', questions: [
    { fieldKey: 'NOTA', label: 'Minha nota', fieldType: 'number', required: true },
    { fieldKey: 'CAMPO_10', label: 'Nota antiga', fieldType: 'number', required: true },
  ] }] as any });
  assert.equal(fields.some(q => ['NOTA', 'NOTA_FINAL', 'CAMPO_10', 'AVALIACAO_NOTA'].includes(q.fieldKey)), false);
  assert.deepEqual(fields.map(q => q.fieldKey), ['RESULTADO', 'PARECER']);
});

test('variáveis legadas de nota ficam vazias e identidade canônica não é sobrescrita', () => {
  const p = { ...process, avaliacao: { ...process.avaliacao, ...accept(), answers: { NOTA_FINAL: 2, ORIENTADOR_EMAIL: 'intruso@example.invalid' } } };
  const vars = buildProcessVariables({ process: p, actorEmail: process.orientador.email, actorRoles: ['ADVISOR'], eventCode: 'EVALUATION_SUBMITTED' });
  assert.equal(vars.NOTA_FINAL, ''); assert.equal(vars.CAMPO_10, ''); assert.equal(vars.AVALIACAO_NOTA, '');
  assert.equal(vars.ORIENTADOR_EMAIL, process.orientador.email);
});

test('aparência publicada elimina exceções antigas e mantém estrutura de colunas e conteúdo', () => {
  const input = { ...settings, tableLayouts: { defenses: { inheritGlobalAppearance: false, textFormat: { fontSize: 'xs' }, columnOrder: ['titulo'], customLabels: { titulo: 'Trabalho' } } },
    portalAppearance: { schemaVersion: 3, linkedItems: { sheet_calendar: false, popup_login: false }, generalPopups: { uploadAtaHeaderBg: '#005830' }, loginPopup: { title: 'Meu portal', primaryBtnBg: '#ff0000' } } };
  const result = normalizeUnifiedAppearance(input);
  assert.equal(result.tableLayouts!.defenses.textFormat, undefined);
  assert.deepEqual(result.tableLayouts!.defenses.columnOrder, ['titulo']);
  assert.equal(result.portalAppearance!.linkedItems!.popup_login, true);
  assert.equal(result.portalAppearance!.loginPopup!.title, 'Meu portal');
  assert.equal(result.portalAppearance!.loginPopup!.primaryBtnBg, result.portalAppearance!.globalPopupStyle!.actionBgColor);
  assert.deepEqual(normalizeUnifiedAppearance(result), result);
});

test('a fonte e as cores publicadas são iguais nas tabelas e nos pop-ups', () => {
  for (const font of ['georgia', 'Roboto, sans-serif', 'Nunito, sans-serif', 'mono']) {
    const result = normalizeUnifiedAppearance({ ...settings, tableAppearance: { fontFamily: 'inter', customHeaderColor: '#ff0000' }, portalAppearance: { schemaVersion: 4, globalPopupStyle: { fontFamily: font, headerBgColor: '#005830' } as any } });
    assert.equal(portalFontFamily(result.tableAppearance?.fontFamily), result.portalAppearance?.globalPopupStyle?.fontFamily);
    assert.equal(result.tableAppearance?.customHeaderColor, '#005830');
    assert.deepEqual(normalizeUnifiedAppearance(result), result);
  }
});

 test('conceitos canônicos prevalecem sobre configuração legada com louvor',()=>{
  const legacy={...settings,evaluationOutcomeOptions:[{code:'LOUVOR',label:'Aprovado com louvor'}]};
  for(const [code,label]of [['APROVADO','Aprovado'],['APROVADO_COM_RESSALVA','Aprovado com ressalva'],['REPROVADO','Reprovado']]){
   assert.equal(acceptEvaluation(process,{...valid,resultadoCode:code},legacy,process.orientador.email,now).resultadoLabel,label);
  }
  assert.throws(()=>acceptEvaluation(process,{...valid,resultadoCode:'LOUVOR'},legacy,process.orientador.email,now),EvaluationError);
 });
