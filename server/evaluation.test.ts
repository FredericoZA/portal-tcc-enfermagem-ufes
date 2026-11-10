import test from 'node:test';
import assert from 'node:assert/strict';
import { DEMO_PROCESSES, INITIAL_SETTINGS } from '../src/services/demoSeed';
import { acceptEvaluation, EvaluationError } from './workflow/evaluation';
import { EVALUATION_OUTCOMES, evaluationQuestions, standardEvaluationOpinion, acceptEvaluationAnswers } from '../src/utils/evaluationForm';
import { buildProcessVariables, mergeWorkflowVariables } from './workflow/runtime';
import { renderGoogleDriveTemplateToPdf } from './integrations/googleDocsRenderer';
import { createProfessionalPdf } from './documents/simplePdf';
import { processEmailMessage } from '../src/utils/processEmailMessage';
import { normalizeUnifiedAppearance } from '../src/utils/unifiedAppearance';
import { portalFontFamily } from '../src/utils/portalFonts';

const process = structuredClone(DEMO_PROCESSES[0]);
const settings = structuredClone(INITIAL_SETTINGS);
const now = new Date('2026-09-09T16:00:00Z');
const valid = { answers:{COORIENTADOR_PRESENTE:'Não'}, resultadoCode: 'APROVADO', parecer: 'Parecer registrado pelo orientador.', dataConfirmed: true,
  expectedDataRevision: process.dataRevision, expectedSchemaRevision: settings.integrationStudio?.revision || 0 };
const accept = (patch: Record<string, unknown> = {}) => acceptEvaluation(process, { ...valid, ...patch, answers:{...valid.answers,...(patch.answers as Record<string,unknown>||{})} }, settings, process.orientador.email, now);

test('rascunhos completos podem ser registrados com ou sem considerações adicionais', () => {
  assert.equal(standardEvaluationOpinion(), '');
  const countWords = (text: string) => text.match(/[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*/gu)?.length ?? 0;
  const conceptSpecificText = {
    APROVADO: /(?:sustentam|fundamenta) o conceito Aprovado/,
    APROVADO_COM_RESSALVA: /Aprovado com ressalva/,
    REPROVADO: /ainda não reúnem? condições suficientes/,
  };
  for (const outcome of EVALUATION_OUTCOMES) {
    const drafts = [0, 0.5, 0.99].map(value => standardEvaluationOpinion(outcome, () => value));
    assert.equal(new Set(drafts).size, 3);
    for (const draft of drafts) {
      assert.ok(!draft.includes(process.titulo));
      assert.ok(draft.includes(outcome.label));
      assert.ok(countWords(draft) >= 80 && countWords(draft) <= 100);
      assert.match(draft, conceptSpecificText[outcome.code as keyof typeof conceptSpecificText]);
      assert.doesNotMatch(draft, /[\[\]\n]|nota numérica/i);
      assert.ok(!draft.includes(process.aluno1.email));
      assert.ok(!draft.includes(process.aluno1.matricula));
      assert.equal(accept({ resultadoCode: outcome.code, parecer: draft }).parecer, draft);
    }
    const withNotes = drafts[0] + '\n\nConsiderações adicionais registradas na sessão.';
    assert.equal(acceptEvaluationAnswers({ resultadoCode: outcome.code, parecer: withNotes }, [outcome]).parecer, withNotes);
    assert.throws(() => acceptEvaluationAnswers({ resultadoCode: outcome.code, parecer: '[completar fundamentação]' }, [outcome]), /Complete a fundamentação/);
  }
});

test('parecer dispensa dados de identificação já registrados na ata', () => {
  for (const outcome of EVALUATION_OUTCOMES) {
    const draft = standardEvaluationOpinion(outcome, () => 0);
    assert.ok(!draft.includes(process.aluno1.nome));
    assert.doesNotMatch(draft, /Autoria:|instrumento validado|amostra de|resultados estatísticos|Portal do Professor|assinatura|texto padronizado/);
    assert.ok(draft.split(/\s+/).length >= 80 && draft.split(/\s+/).length <= 100);
    assert.equal(acceptEvaluationAnswers({resultadoCode:outcome.code,parecer:draft},[outcome]).parecer,draft);
  }
});

test('conceito desconhecido não gera rascunho',()=>{
  assert.equal(standardEvaluationOpinion({code:'NAO_PREVISTO',label:'Resultado desconhecido'}),'');
  assert.equal(standardEvaluationOpinion({code:'constructor',label:'constructor'}),'');
});

test('avaliação aceita resultado e parecer sem nota numérica e preserva a conferência', () => {
  const result = accept({ notaFinal: '9,25', answers: { NOTA_FINAL: 9.25 } });
  assert.equal(result.resultadoLabel, 'Aprovado');
  assert.equal((result as any).notaFinal, undefined);
  assert.equal(result.answers.NOTA_FINAL, undefined);
  assert.equal(result.dataReview.confirmedBy, process.orientador.email);
  assert.equal(result.dataReview.sourceDataRevision, process.dataRevision);
  assert.ok(result.dataReview.fields.some(([, value]) => value.includes(process.aluno1.nome)));
  assert.ok(result.dataReview.fields.every(([, value]) => !value.includes(process.aluno1.matricula)));
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

test('três conceitos chegam ao PDF da ata e à comunicação autorizada sem nota ou frequência', async () => {
  const {getDocument} = await import('pdfjs-dist/legacy/build/pdf.mjs');
  for (const {code,label} of EVALUATION_OUTCOMES) {
    const evaluated = accept({
      resultadoCode:code, notaFinal:9.25,
      answers:{NOTA_FINAL:9.25,FREQUENCIA:'DADO-QUE-NAO-DEVE-SER-PUBLICADO'}
    });
    const evaluatedProcess = {...process,avaliacao:{status:'CONCLUIDO' as const,...evaluated}};
    const variables = buildProcessVariables({process:evaluatedProcess,eventCode:'EVALUATION_SUBMITTED',
      actorEmail:process.orientador.email,actorRoles:['ADVISOR']});
    assert.equal(variables.RESULTADO,label);
    assert.equal(variables.CAMPO_09,label);
    assert.equal(variables.NOTA_FINAL,'');
    assert.equal(variables.FREQUENCIA,undefined);

    // Simulate only the provider's edit/export APIs. The application's
    // replacement requests, temporary copy and unresolved-marker check are real.
    const model = 'syntheticAtaModel';
    const copy = 'syntheticAtaCopy';
    let merged = `Conceito: <<CAMPO_09>>
Parecer: <<CAMPO_11>>
<<AVALIACAO_NOTA>>
`;
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = String(input);
      if (url.includes('/files/' + model + '?fields=')) {
        return Response.json({id:model,name:'Ata',mimeType:'application/vnd.google-apps.document',capabilities:{canCopy:true}});
      }
      if (url.includes('/files/' + model + '/copy?')) return Response.json({id:copy});
      if (url.includes('/documents/' + copy + '?')) {
        return Response.json({documentId:copy,revisionId:'1',body:{content:[{
          startIndex:1,endIndex:merged.length+1,paragraph:{elements:[{
            startIndex:1,endIndex:merged.length+1,textRun:{content:merged}
          }]}
        }]}});
      }
      if (url.endsWith('/documents/' + copy + ':batchUpdate')) {
        const requests = JSON.parse(String(init?.body)).requests;
        const replies = requests.map(({replaceAllText}: {replaceAllText?: {containsText:{text:string};replaceText:string}}) => {
          if (!replaceAllText) return {};
          const {containsText:{text},replaceText} = replaceAllText;
          const parts = merged.split(text);
          merged = parts.join(replaceText);
          return {replaceAllText:{occurrencesChanged:parts.length-1}};
        });
        return Response.json({documentId:copy,replies});
      }
      if (url.includes('/files/' + copy + '/export?')) {
        const pdf = await createProfessionalPdf({title:'Ata',protocol:evaluatedProcess.protocolo,body:merged});
        return new Response(new Uint8Array(pdf));
      }
      if (url.includes('/files/' + copy + '?') && init?.method === 'DELETE') return new Response(null,{status:204});
      throw new Error(`Unexpected provider operation: ${init?.method || 'GET'} ${url}`);
    };
    const rendered = await renderGoogleDriveTemplateToPdf({accessToken:'fixture-only',templateUrlOrId:model,
      replacements:{CAMPO_09:variables.CAMPO_09,CAMPO_11:variables.CAMPO_11,AVALIACAO_NOTA:variables.AVALIACAO_NOTA},fetchImpl});
    assert.equal(rendered.replacementsChanged,3);
    assert.deepEqual(rendered.unresolvedMarkers,[]);
    const loading = getDocument({data:new Uint8Array(rendered.pdf),verbosity:0});
    try {
      const pdf = await loading.promise;
      const text = (await (await pdf.getPage(1)).getTextContent()).items.map(item=>'str' in item?item.str:'').join(' ');
      assert.ok(text.includes('Conceito: ' + label));
      assert.ok(text.includes(evaluated.parecer));
      assert.doesNotMatch(text,/9[.,]25|DADO-QUE-NAO-DEVE-SER-PUBLICADO/);
    } finally { await loading.destroy(); }

    // Stock notices guide recipients to the process. A configurable notice
    // that explicitly uses the concept resolves the same canonical label.
    const mail = processEmailMessage({process:evaluatedProcess,recipient:process.orientador.email,
      subject:'Conceito registrado',text:mergeWorkflowVariables('Conceito registrado: <<RESULTADO>>.',variables),
      eventCode:'EVALUATION_SUBMITTED',baseUrl:'https://portal.example',courseName:'Enfermagem',templateVariables:variables});
    assert.ok(mail.text.includes('Conceito registrado: ' + label + '.'));
    assert.ok(mail.html.includes('Conceito registrado: ' + label + '.'));
    assert.doesNotMatch(mail.text,/9[.,]25|DADO-QUE-NAO-DEVE-SER-PUBLICADO/);
  }
});


test('parecer varies throughout the paragraph and never repeats the immediately previous draft',()=>{
 for(const outcome of EVALUATION_OUTCOMES){
  const drafts=new Set<string>();
  for(let code=0;code<81;code++){
   let combination=code;
   const random=()=>{const index=combination%3;combination=Math.floor(combination/3);return(index+0.01)/3;};
   const draft=standardEvaluationOpinion(outcome,random);
   drafts.add(draft);
   assert.ok(draft.split(/\s+/).length>=80&&draft.split(/\s+/).length<=100);
   assert.match(draft,/^(?:O trabalho|No trabalho|Quanto ao trabalho)/);
   assert.doesNotMatch(draft,/apresenta o seguinte parecer|apresenta suas considerações|\n|\{\{/);
   assert.equal(accept({resultadoCode:outcome.code,parecer:draft}).parecer,draft);
  }
  assert.equal(drafts.size,81);
  const first=standardEvaluationOpinion(outcome,()=>0);
  const next=standardEvaluationOpinion(outcome,()=>0,first);
  assert.notEqual(next,first,'constant random source still cannot repeat the current paragraph');
  assert.ok(!next.includes(process.aluno1.nome));
 }
});
