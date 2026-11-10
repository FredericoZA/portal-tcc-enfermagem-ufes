import test from 'node:test';
import assert from 'node:assert/strict';
import {isRegistrationIdentifierField,registrationAnswersWithoutIdentifiers,registrationPayload,registrationQuestions} from '../../src/utils/operationalConfig';
import {acceptRegistration} from './registration';
import {saveRegistrationDraft} from './drafts';
import {ACADEMIC_PERIOD_FIELD,academicPeriodOptions} from '../../src/utils/academicPeriod';

const answers = () => ({
  ALUNO_1_NOME:'Maria da Silva',ALUNO_1_EMAIL:'maria@example.invalid',TEM_ALUNO_2:'Sim',
  ALUNO_2_NOME:'João Ferreira',ALUNO_2_EMAIL:'joao@example.invalid',
  ORIENTADOR_NOME:'Ana Souza',ORIENTADOR_EMAIL:'ana@example.invalid',TEM_COORIENTADOR:'Não',
  EXAMINADOR_2_NOME:'Beatriz Lima',EXAMINADOR_2_EMAIL:'beatriz@example.invalid',EXAMINADOR_2_INSTITUICAO:'UFES',
  EXAMINADOR_3_NOME:'Carlos Mendes',EXAMINADOR_3_EMAIL:'carlos@example.invalid',EXAMINADOR_3_INSTITUICAO:'UFES',
  TITULO:'Cuidado em Saúde',DEFESA_DATA_HORA:'2026-11-06T14:00',DEFESA_LOCAL:'Sala de reuniões do Departamento de Enfermagem - CCS/UFES'
});
const oldQuestions = [
  ['ALUNO_1_MATRICULA','Matrícula'],['ALUNO_MATRICULA','Matrícula antiga'],
  ['ORIENTADOR_CIAP','Registro funcional'],['EXAMINADOR_2_SIAPE','SIAPE'],
  ['CPF','CPF'],['ALUNO_2_CPF','CPF do aluno'],['COORIENTADOR_REGISTRO','Outro registro'],
  ['CAMPO_05','Matrícula, SIAPE ou outro registro'],['CAMPO_ANTIGO','Número do CPF']
].map(([fieldKey,label])=>({id:`old-${fieldKey}`,fieldKey,label,fieldType:'text',section:'Aluno',required:true}));
const studio = {revision:12,formTemplates:[{id:'form-reserva-aluno',questions:[...oldQuestions,{id:'note',fieldKey:'REGISTRO_DA_DEFESA',label:'Registro da defesa',fieldType:'text',required:false}]}]} as any;

test('período estatístico é opcional, explícito e preservado no aceite e no rascunho',()=>{
  const question=registrationQuestions(studio).find(item=>item.fieldKey===ACADEMIC_PERIOD_FIELD)!;
  assert.equal(question.required,false);assert.equal(question.section,'Trabalho');
  assert.equal(question.label,'A qual período acadêmico esta apresentação se refere?');
  assert.ok(question.options?.includes('Não informado'));
  const supplied={...answers(),[ACADEMIC_PERIOD_FIELD]:'2026-2'};
  const accepted=acceptRegistration({registrationAnswers:supplied},studio);
  assert.equal(accepted.registrationAnswers[ACADEMIC_PERIOD_FIELD],'2026-2');
  assert.equal(accepted.defesa.startAt,acceptRegistration({registrationAnswers:answers()},studio).defesa.startAt);
  assert.equal(acceptRegistration({registrationAnswers:answers()},studio).registrationAnswers[ACADEMIC_PERIOD_FIELD],undefined);
  assert.equal(acceptRegistration({registrationAnswers:{...answers(),[ACADEMIC_PERIOD_FIELD]:'Não informado'}},studio).registrationAnswers[ACADEMIC_PERIOD_FIELD],'Não informado');
  for(const period of academicPeriodOptions().filter(value=>value!=='Não informado')){
    const result=acceptRegistration({registrationAnswers:{...answers(),[ACADEMIC_PERIOD_FIELD]:period}},studio);
    assert.equal(result.registrationAnswers[ACADEMIC_PERIOD_FIELD],period);
    assert.equal(result.defesa.startAt,accepted.defesa.startAt);
  }
  assert.throws(()=>acceptRegistration({registrationAnswers:{...answers(),[ACADEMIC_PERIOD_FIELD]:'2026-3'}},studio),/escolha uma opção/);
  const draft=saveRegistrationDraft(undefined,{expectedRevision:0,schemaRevision:12,section:6,answers:supplied},'maria@example.invalid',studio);
  assert.equal(draft.answers[ACADEMIC_PERIOD_FIELD],'2026-2');
  assert.deepEqual(academicPeriodOptions('2020-2',new Date('2026-11-07T12:00:00Z')),['Não informado','2020-2','2025-1','2025-2','2026-1','2026-2','2027-1','2027-2']);
});

test('schema de cadastro não coleta identificadores mesmo com campos e aliases antigos publicados',()=>{
  for(const fields of [registrationQuestions(),registrationQuestions(studio)]) {
    assert.ok(fields.length>0);
    assert.ok(!fields.some(field=>isRegistrationIdentifierField(field.fieldKey,field.label)));
    for(const key of ['ALUNO_1_NOME','ALUNO_1_EMAIL','ALUNO_2_NOME','ORIENTADOR_EMAIL','TITULO','AREA_TEMATICA'])assert.ok(fields.some(field=>field.fieldKey===key));
  }
  assert.ok(registrationQuestions(studio).some(field=>field.fieldKey==='REGISTRO_DA_DEFESA'));
  assert.equal(studio.formTemplates[0].questions.length,oldQuestions.length+1);
});

test('predicado limita registro pessoal sem retirar o registro do processo ou a concordância documental',()=>{
  for(const key of ['ALUNO_1_MATRICULA','MATRÍCULA','ORIENTADOR_SIAPE','ORIENTADOR_CIAP','CPF','ALUNO_2_CPF','EXAMINADOR_3_REGISTRO'])assert.equal(isRegistrationIdentifierField(key),true,key);
  assert.equal(isRegistrationIdentifierField('CAMPO_05','Número de matrícula'),true);
  for(const key of ['REGISTRO_DA_DEFESA','REGISTRO_DA_RESERVA','AUTORIA_MATRICULADOS','TCC_CODIGO','TITULO','ALUNO_1_NOME','ALUNO_1_EMAIL'])assert.equal(isRegistrationIdentifierField(key),false,key);
});

test('cadastro válido não depende de matrícula, CPF ou SIAPE',()=>{
  const result=acceptRegistration({registrationAnswers:answers()},studio);
  assert.equal(result.aluno1.email,'maria@example.invalid');
  assert.equal(result.aluno2?.email,'joao@example.invalid');
  assert.equal(result.orientador.email,'ana@example.invalid');
  assert.equal(result.banca.length,2);
  assert.equal(result.aluno1.matricula,'');
  assert.equal(result.orientador.siape,'');
  assert.ok(!Object.keys(result.registrationAnswers).some(key=>isRegistrationIdentifierField(key)));
});

test('payload e aceite descartam valores ocultos sem modificar dados de origem',()=>{
  const supplied={...answers(),ALUNO_1_MATRICULA:'00001234',ALUNO_2_MATRICULA:'00005678',ORIENTADOR_SIAPE:'1234567',ORIENTADOR_CIAP:'7654321',ALUNO_1_CPF:'12345678900',CPF:'12345678900',CAMPO_05:'00009999',CAMPO_ANTIGO:'12345678900',REGISTRO_DA_DEFESA:'Registro complementar'};
  const before=structuredClone(supplied);
  const accepted=acceptRegistration({registrationAnswers:supplied,aluno1:{matricula:'outro'}},studio);
  assert.equal(accepted.registrationAnswers.CAMPO_05,undefined);
  assert.equal(accepted.registrationAnswers.CAMPO_ANTIGO,undefined);
  assert.equal(accepted.registrationAnswers.REGISTRO_DA_DEFESA,'Registro complementar');
  assert.equal(accepted.aluno1.matricula,'');
  assert.equal(accepted.orientador.siape,'');
  const payload=registrationPayload(supplied,'America/Sao_Paulo');
  assert.ok(!Object.keys(payload.registrationAnswers).some(key=>isRegistrationIdentifierField(key)));
  assert.equal(payload.aluno2?.matricula,'');
  assert.equal(payload.orientador.siape,'');
  assert.deepEqual(supplied,before);
});

test('cliente antigo com identificadores nas pessoas não os persiste no novo cadastro',()=>{
  const payload=registrationPayload(answers(),'America/Sao_Paulo');
  const {registrationAnswers:_answers,...persons}=payload;
  const result=acceptRegistration({...persons,personPresentationVersion:1,aluno1:{...persons.aluno1,matricula:'00001234',cpf:'12345678900'},orientador:{...persons.orientador,siape:'1234567',ciap:'7654321'}},studio);
  assert.equal(result.aluno1.matricula,'');
  assert.equal(result.orientador.siape,'');
  assert.ok(!Object.keys(result.registrationAnswers).some(key=>isRegistrationIdentifierField(key)));
});

test('novo rascunho ignora identificadores e preserva objeto histórico anterior',()=>{
  const now=new Date('2026-11-05T12:00:00Z');
  const previous={ownerEmail:'maria@example.invalid',answers:{ALUNO_1_MATRICULA:'historico'},section:0,revision:2,schemaRevision:12,updatedAt:now.toISOString(),expiresAt:'2026-12-01T12:00:00Z'};
  const before=structuredClone(previous);
  const saved=saveRegistrationDraft(previous,{expectedRevision:2,schemaRevision:12,section:1,answers:{...answers(),CPF:'12345678900',ALUNO_1_MATRICULA:'novo',ORIENTADOR_CIAP:'novo',CAMPO_05:'novo',REGISTRO_DA_DEFESA:'Registro complementar'}},'maria@example.invalid',studio,now);
  assert.ok(!Object.keys(saved.answers).some(key=>isRegistrationIdentifierField(key)));
  assert.equal(saved.answers.CAMPO_05,undefined);
  assert.equal(saved.answers.REGISTRO_DA_DEFESA,'Registro complementar');
  assert.equal(saved.answers.ALUNO_1_EMAIL,'maria@example.invalid');
  assert.deepEqual(previous,before);
  assert.deepEqual(registrationAnswersWithoutIdentifiers(previous.answers),{});
});
