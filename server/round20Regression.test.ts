import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {PDFDocument,StandardFonts} from 'pdf-lib';
import {inspectPdfLayout} from './workflow/documentQuality';
import {previewProcess} from './workflow/modelPreview';
import {evaluationPreviewToken,validEvaluationPreview} from './security/evaluationPreview';
import {evaluationOutcomeLabel,standardEvaluationOpinion} from '../src/utils/evaluationForm';

test('amostra usa data válida mesmo quando Estúdio apresenta data canônica como texto',()=>{
 const sample=previewProcess({formTemplates:[{id:'form-reserva-aluno',questions:[{fieldKey:'DEFESA_DATA_HORA',fieldType:'text',label:'Data e hora'}]}] as any});
 assert.ok(Number.isFinite(Date.parse(sample.process.defesa.startAt)));
 assert.ok(Number.isFinite(Date.parse(sample.variables.DEFESA_DATA_HORA)));
});
test('validação do comprovante lê PDF real e função inclui o worker do PDF.js',async()=>{
 const doc=await PDFDocument.create();const font=await doc.embedFont(StandardFonts.Helvetica);doc.addPage().drawText('Reserva de sala confirmada',{font,x:40,y:700});
 const result=await inspectPdfLayout(Buffer.from(await doc.save()));assert.equal(result.pages,1);assert.ok(result.extractedCharacters>15);
 const config=JSON.parse(readFileSync('vercel.json','utf8'));assert.match(config.functions['api/index.ts'].includeFiles,/pdf\.worker\.mjs/);
 assert.ok(existsSync('node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs'));
});
test('conferência da ata expira e rejeita alteração de parecer, modelo, revisão ou ator',()=>{
 const binding={process:'p',revision:3,actor:'orientador@example.invalid',model:'hash',parecer:'Parecer'};const token=evaluationPreviewToken('secret',binding,2000);
 assert.ok(validEvaluationPreview(token,'secret',binding,1000));assert.ok(!validEvaluationPreview(token,'secret',binding,2000));
 for(const patch of [{revision:4},{actor:'outro@example.invalid'},{model:'novo'},{parecer:'Outro'}])assert.ok(!validEvaluationPreview(token,'secret',{...binding,...patch},1000));
 assert.ok(!validEvaluationPreview(token+'x','secret',binding,1000));
});
test('prévia de ata longa vincula todo o conteúdo por hash sem expor o texto no token',()=>{
 const binding={process:'p',revision:3,actor:'orientador@example.invalid',documentText:'Texto confidencial da ata '.repeat(2400),answers:{PARECER:'Parecer completo'}};
 const token=evaluationPreviewToken('secret',binding,2000);
 assert.ok(token.length<400,'token size is independent of the document length');
 assert.ok(validEvaluationPreview(token,'secret',binding,1000));
 assert.ok(!validEvaluationPreview(token,'secret',{...binding,documentText:binding.documentText+'x'},1000));
 assert.ok(!Buffer.from(token.split('.')[0],'base64url').toString().includes('Texto confidencial'));
});
test('resultados antigos perdem faixas numéricas e ressalvas usam texto-base sem mérito inventado',()=>{
 const option={code:'APROVADO_RESTRICAO',label:'Aprovado com Restrição (5,00 ≤ x < 7,00)'};assert.equal(evaluationOutcomeLabel(option),'Aprovado com ressalva');
 const opinion=standardEvaluationOpinion({} as any,option);
 assert.match(opinion,/Aprovado com ressalva/);
 assert.match(opinion,/Fundamentação e ressalvas: \[Completar/);
 assert.doesNotMatch(opinion,/5,00|7,00/);
});

test('rascunhos consecutivos são estáveis e exigem fundamentação humana',()=>{
 const option={code:'APROVADO',label:'Aprovado'};const first=standardEvaluationOpinion({} as any,option);const second=standardEvaluationOpinion({} as any,option);
 assert.equal(first,second);
 assert.match(first,/Aprovado/);
 assert.match(first,/\[Completar com os fundamentos/);
 assert.doesNotMatch(first,/clareza|domínio do tema|aprovação do trabalho/i);
});
