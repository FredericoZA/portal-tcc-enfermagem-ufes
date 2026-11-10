import test from 'node:test';
import assert from 'node:assert/strict';
import {registrationFindings,registrationParticipantLabel} from '../src/utils/workflowOperations';
test('dados repetidos são explicados por função, sem variáveis nem ordinal',()=>{
 const findings=registrationFindings({ALUNO_1_NOME:'Ana Silva',ALUNO_2_NOME:'Ana Silva',ALUNO_1_EMAIL:'ana@example.invalid',EXAMINADOR_2_EMAIL:'ANA@example.invalid'});
 assert.ok(findings.some(finding=>finding.severity==='ERROR'&&finding.message.includes('Cada participante deve usar um e-mail diferente')));
 assert.ok(findings.some(finding=>finding.message.includes('O nome Ana Silva')));
 for(const finding of findings){assert.doesNotMatch(registrationParticipantLabel(finding.fieldKey),/_[123]| [123]/);assert.doesNotMatch(finding.message,/ALUNO_|EXAMINADOR_/);}
 assert.deepEqual(registrationFindings({ALUNO_1_EMAIL:'ana@example.invalid',ORIENTADOR_EMAIL:'professor@example.invalid',CONTATO_EMAIL:'ana@example.invalid'}),[]);
});
test('conferência de identificação considera somente nomes e e-mails dos participantes',()=>{
 const answers={ORIENTADOR_NOME:'Professor',COORIENTADOR_NOME:'Docente 2',LOCAL_OUTRO_NOME:'Auditório',ALUNO_1_MATRICULA:'123',ORIENTADOR_SIAPE:'123'};
 const before=structuredClone(answers);
 const findings=registrationFindings(answers);
 assert.deepEqual(findings.map(item=>item.fieldKey),['ORIENTADOR_NOME','COORIENTADOR_NOME']);
 for(const finding of findings){assert.equal(finding.severity,'WARNING');assert.doesNotMatch(finding.message,/matrícula|números|siape/i);}
 assert.deepEqual(answers,before);
 assert.deepEqual(registrationFindings({ORIENTADOR_NOME:'Maria da Silva',COORIENTADOR_NOME:'João de Souza',LOCAL_OUTRO_NOME:'Auditório'}),[]);
});
