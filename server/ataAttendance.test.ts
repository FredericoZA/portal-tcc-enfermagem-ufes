import test from 'node:test';
import assert from 'node:assert/strict';
import {DEMO_PROCESSES,INITIAL_SETTINGS} from '../src/services/demoSeed';
import {acceptEvaluation,EvaluationError} from './workflow/evaluation';
import {acceptEvaluationAnswers,EVALUATION_OUTCOMES} from '../src/utils/evaluationForm';
import {ataReviewColumns,joinAtaReviewColumns} from '../src/utils/ataReviewLayout';
import {adaptDocumentLanguage} from '../src/utils/documentLanguage';
import {academicName} from '../src/utils/personPresentation';

test('presença do coorientador é confirmada explicitamente antes de gerar ou registrar ata',()=>{
  const process=structuredClone(DEMO_PROCESSES.find(item=>item.coorientador)!);
  const input={resultadoCode:'APROVADO',parecer:'A banca registrou o resultado após a defesa.',dataConfirmed:true,expectedDataRevision:process.dataRevision,expectedSchemaRevision:INITIAL_SETTINGS.integrationStudio?.revision||0};
  const accept=(answers?:Record<string,unknown>)=>acceptEvaluation(process,{...input,answers},INITIAL_SETTINGS,process.orientador.email,new Date('2099-01-01'),{previewOnly:true});
  assert.throws(()=>accept(),(error:EvaluationError)=>error.code==='COADVISOR_ATTENDANCE_REQUIRED');
  for(const value of [true,false,'Talvez',1])assert.throws(()=>accept({COORIENTADOR_PRESENTE:value}));
  assert.equal(accept({COORIENTADOR_PRESENTE:'Sim'}).coadvisorPresent,true);
  assert.equal(accept({COORIENTADOR_PRESENTE:'Não'}).coadvisorPresent,false);
  process.coorientador=null;
  assert.equal(accept().coadvisorPresent,false);
  assert.throws(()=>accept({COORIENTADOR_PRESENTE:'Sim'}),(error:EvaluationError)=>error.code==='INVALID_COADVISOR_ATTENDANCE');
});

test('resposta de presença permanece no rascunho aceito sem liberar campos arbitrários',()=>{
  const result=acceptEvaluationAnswers({resultadoCode:'APROVADO',parecer:'Parecer da banca.',answers:{COORIENTADOR_PRESENTE:'Não',CPF:'descartar',CAMPO_DESCONHECIDO:'descartar'}},EVALUATION_OUTCOMES);
  assert.deepEqual(result.answers,{COORIENTADOR_PRESENTE:'Não',RESULTADO:'APROVADO',PARECER:'Parecer da banca.'});
});

test('edição espelha duas colunas nativas sem perder negrito nem tabulações',()=>{
  const paragraph={tabStops:[{offset:100,alignment:'CENTER' as const},{offset:300,alignment:'CENTER' as const}],runs:[{text:'\tProf. ',bold:true},{text:'Nome\tAluno ',bold:true},{text:'Um\n'}]};
  const columns=ataReviewColumns(paragraph)!;
  assert.deepEqual(columns,[[{text:'Prof. ',bold:true},{text:'Nome',bold:true}],[{text:'Aluno ',bold:true},{text:'Um'}]]);
  assert.equal(joinAtaReviewColumns(columns.map(column=>column.map(run=>run.text).join(''))),'\tProf. Nome\tAluno Um');
  assert.equal(ataReviewColumns({runs:[{text:'Parágrafo comum'}]}),null);
  assert.equal(ataReviewColumns({...paragraph,runs:[{text:'Texto\tPessoa\tPessoa'}]}),null);
});

test('ata só declara a participação do coorientador quando confirmada',()=>{
  const process=structuredClone(DEMO_PROCESSES.find(item=>item.coorientador)!);
  const source='Abertura, apresentando os demais examinadores. Foi dada a palavra aos autores.';
  process.avaliacao.coadvisorPresent=true;
  const present=adaptDocumentLanguage(source,process,'ATA');
  assert.match(present,/Participou também/);
  assert.ok(present.includes(academicName(process.coorientador,'abbreviated')));
  process.avaliacao.coadvisorPresent=false;
  assert.doesNotMatch(adaptDocumentLanguage(source,process,'ATA'),/Participou também/);
  assert.doesNotMatch(adaptDocumentLanguage(present,process,'ATA'),/Participou também/);
});
