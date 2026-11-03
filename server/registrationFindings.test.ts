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
