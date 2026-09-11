import assert from 'node:assert/strict';
import test from 'node:test';
import { buildProcessArchiveFileName } from './googleDriveArchive';

test('nome de formulário contém código, alunos, tipo e versão', () => {
  assert.equal(
    buildProcessArchiveFileName({
      protocol: 'TCC-2026-0042',
      studentNames: ['Ana Vitória', 'João D’Ávila'],
      artifactLabel: 'FORMULARIO_DADOS_FINAIS',
      version: 2
    }),
    'TCC_2026_0042__ANA_E_JOAO__FORMULARIO_DADOS_FINAIS__v002.pdf'
  );
});

test('nome de arquivo remove caracteres impróprios do Drive', () => {
  const fileName = buildProcessArchiveFileName({
    protocol: 'TCC/2026:*0001',
    studentNames: ['Aluno <Teste>'],
    artifactLabel: 'Cadastro inicial',
    version: 1,
    extension: '.p$d$f'
  });
  assert.match(fileName, /^TCC_2026_0001__ALUNO__CADASTRO_INICIAL__v001\.pdf$/);
});
