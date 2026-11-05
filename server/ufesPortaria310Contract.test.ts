import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const read=(path:string)=>readFileSync(path,'utf8');

test('Informações Gerais contém a Portaria UFES 310/2026 e sua transcrição para consulta',()=>{
  const page=read('src/pages/InformacoesGeraisTccPage.tsx');
  assert.match(page,/Legislação e proteção de dados/);
  assert.match(page,/Portaria Normativa GR\/Ufes nº 310/);
  assert.match(page,/\/legislacao\/PORTARIA_NORMATIVA_GR_UFES_310_2026\.md/);
  assert.ok(existsSync('public/legislacao/PORTARIA_NORMATIVA_GR_UFES_310_2026.md'));
  const norm=read('public/legislacao/PORTARIA_NORMATIVA_GR_UFES_310_2026.md');
  assert.match(norm,/Art\. 17\./);
  assert.match(norm,/Art\. 19\./);
  assert.match(norm,/Art\. 32\./);
  assert.match(page,/não substituem as exigências institucionais/);
});

test('o Portal não executa analisador generativo nem motor de propostas',()=>{
  const server=read('server.ts');
  assert.equal(existsSync('server/continuousIntelligence.ts'),false);
  assert.equal(existsSync('src/components/AIAnalyzerModal.tsx'),false);
  assert.equal(existsSync('src/components/ContinuousIntelligencePanel.tsx'),false);
  assert.doesNotMatch(server,/app\.(?:all|get|post)\('\/api\/admin\/continuous-intelligence/);
  assert.equal(existsSync('server/statisticalSnapshot.ts'),true);
  assert.doesNotMatch(read('src/services/apiClient.ts'),/getContinuousIntelligence\b/);
  const deps=JSON.parse(read('package.json')).dependencies;
  assert.equal(deps['@google/genai'],undefined);
});

test('parecer utiliza texto-base fixo e indicadores públicos dispensam campos livres',()=>{
  const form=read('src/utils/evaluationForm.ts');
  assert.match(form,/function standardEvaluationOpinion/);
  assert.doesNotMatch(form,/Math\.random\(/);
  assert.match(form,/Fundamentação da decisão/);
  const indicators=read('server/publicIndicators.ts');
  assert.match(indicators,/themes: \[\]/);
  assert.match(indicators,/locations: \[\]/);
  assert.match(indicators,/RESULT_LABELS/);
  assert.doesNotMatch(indicators,/palavrasChave \|\| \[\]\)\.map\(clean\)/);
});

test('documentos não simulam documentos oficiais ou assinaturas inexistentes',()=>{
  const docs=read('src/pages/DocumentosPage.tsx');
  assert.match(docs,/Abrir documentos do TCC/);
  assert.match(docs,/Legislação, privacidade e revisão humana/);
  assert.match(docs,/Portaria Normativa GR\/Ufes nº 310\/2026/);
  assert.doesNotMatch(docs,/generateOfficialDocumentText/);
  assert.doesNotMatch(docs,/contentPreviewText: generateOfficial/);
  assert.doesNotMatch(docs,/isAvailable = docType ===/);
  assert.match(docs,/Disponibilidade e assinaturas: consultar o processo/);
});
test('indicadores públicos suprimem períodos e durações de amostra muito pequena',()=>{
  const indicators=read('server/publicIndicators.ts');
  assert.match(indicators,/peak\.count >= MIN_PUBLIC_BUCKET_SIZE/);
  assert.match(indicators,/completionDays\.length >= MIN_PUBLIC_BUCKET_SIZE/);
  assert.match(indicators,/Object\.prototype\.hasOwnProperty\.call\(STATUS_LABELS,status\)/);
});
