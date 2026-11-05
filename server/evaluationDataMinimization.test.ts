import test from 'node:test';
import assert from 'node:assert/strict';
import type {IntegrationStudioSettings} from '../src/types/integrationStudio';
import type {RegistrationQuestion} from '../src/types/operationalConfig';
import {acceptEvaluationAnswers,evaluationQuestions,EVALUATION_OUTCOMES} from '../src/utils/evaluationForm';
import {isRegistrationIdentifierField} from '../src/utils/operationalConfig';

const questions:RegistrationQuestion[]=[
  ...[['CPF','CPF'],['ALUNO_1_MATRICULA','Matrícula do autor'],['ORIENTADOR_SIAPE','Registro funcional'],['EXAMINADOR_2_CIAP','CIAP'],['CAMPO_ANTIGO','Número do CPF']].map(([fieldKey,label])=>({id:fieldKey,fieldKey,label,fieldType:'text',required:true})),
  {id:'observation',fieldKey:'OBSERVACAO',label:'Observação acadêmica',fieldType:'text',required:false},
];
const schemas:Partial<IntegrationStudioSettings>[]=[
  {processFieldSchemas:{evaluation:questions}},
  {formTemplates:[{id:'form-parecer-banca',questions}] as IntegrationStudioSettings['formTemplates']},
];

test('esquemas atuais e modelos antigos da avaliação não solicitam novos identificadores',()=>{
  for(const studio of schemas){
    const before=structuredClone(studio),fields=evaluationQuestions(studio);
    assert.ok(!fields.some(field=>isRegistrationIdentifierField(field.fieldKey,field.label)));
    assert.deepEqual(fields.map(field=>field.fieldKey),['OBSERVACAO','RESULTADO','PARECER']);
    assert.deepEqual(studio,before);
  }
});

test('aceite da avaliação descarta identificadores enviados por clientes antigos sem mudar conceitos e parecer',()=>{
  for(const studio of schemas)for(const outcome of EVALUATION_OUTCOMES){
    const input={resultadoCode:outcome.code,parecer:'A banca conferiu o trabalho e registrou a fundamentação de sua deliberação.',answers:{CPF:'NOVO-IDENTIFICADOR',ALUNO_1_MATRICULA:'NOVO-IDENTIFICADOR',ORIENTADOR_SIAPE:'NOVO-IDENTIFICADOR',EXAMINADOR_2_CIAP:'NOVO-IDENTIFICADOR',CAMPO_ANTIGO:'NOVO-IDENTIFICADOR',OBSERVACAO:'Comentário acadêmico preservado.'}};
    const before=structuredClone(input),result=acceptEvaluationAnswers(input,EVALUATION_OUTCOMES,studio);
    assert.equal(result.resultadoCode,outcome.code);assert.equal(result.resultadoLabel,outcome.label);assert.equal(result.parecer,input.parecer);
    assert.deepEqual(result.answers,{OBSERVACAO:input.answers.OBSERVACAO,RESULTADO:outcome.code,PARECER:input.parecer});
    assert.doesNotMatch(JSON.stringify(result),/NOVO-IDENTIFICADOR/);assert.deepEqual(input,before);
  }
});
