import assert from 'node:assert/strict';
import test from 'node:test';
import { buildProcessArchiveFileName, buildSupersededAppProperties, isUnsafePrivateContainerPermission } from './googleDriveArchive';

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


test('pasta privada aceita usuários nominais e bloqueia compartilhamento amplo', () => {
  assert.equal(isUnsafePrivateContainerPermission({type:'user',role:'writer',emailAddress:'secretaria@ufes.br'}), false);
  assert.equal(isUnsafePrivateContainerPermission({type:'user',role:'reader',emailAddress:'docente@ufes.br'}), false);
  assert.equal(isUnsafePrivateContainerPermission({type:'anyone',role:'reader'}), true);
  assert.equal(isUnsafePrivateContainerPermission({type:'domain',role:'reader',domain:'ufes.br'}), true);
  assert.equal(isUnsafePrivateContainerPermission({type:'group',role:'reader'}), true);
});


test('preserva metadados do arquivo substituído', () => {
  const result=buildSupersededAppProperties({portal:'portal-tcc',sha256:'abc',artifactType:'TRABALHO_COMPLETO'},'novo-id','2026-09-12T20:00:00.000Z');
  assert.deepEqual(result,{portal:'portal-tcc',sha256:'abc',artifactType:'TRABALHO_COMPLETO',lifecycle:'SUPERSEDED',supersededBy:'novo-id',supersededAt:'2026-09-12T20:00:00.000Z'});
});
