import test from 'node:test';
import assert from 'node:assert/strict';
import { listAuthorizedAstenRepositories, parseAstenAccountAndRepository } from './asten';

const identity={Usuario:{id:41}};
const repos=[
  {id:5,nome:'TCC Enfermagem',Usuario:{id:41},isProprietario:'S'},
  {id:6,nome:'Outro setor',Usuario:{id:41},compartilharCriacaoDocs:'S'},
  {id:7,nome:'Somente leitura',Usuario:{id:41},isProprietario:'N',compartilharCriacaoDocs:'N'},
  {id:8,nome:'Terceiros',Usuario:{id:99},isProprietario:'S'}
];

test('mostra somente repositórios autorizados e não escolhe arbitrariamente',()=>{
  const catalog=listAuthorizedAstenRepositories(identity,repos);
  assert.equal(catalog.identifier,'41');
  assert.deepEqual(catalog.repositories.map(item=>item.id),[6,5]);
  assert.throws(()=>parseAstenAccountAndRepository(identity,repos,undefined),/vários repositórios/);
  assert.deepEqual(parseAstenAccountAndRepository(identity,repos,'5'),{identifier:'41',repositoryId:5});
});

test('seleção fornecida pelo navegador nunca autoriza repositório não elegível',()=>{
  for(const id of ['7','8','999'])assert.throws(()=>parseAstenAccountAndRepository(identity,repos,id),/não pertence à conta ou não permite/);
  assert.throws(()=>parseAstenAccountAndRepository(identity,repos,'abc'),/ID numérico válido/);
  assert.throws(()=>parseAstenAccountAndRepository(identity,repos,'0'),/ID numérico válido/);
});

test('conta com um único repositório pode conectar sem seleção; sem permissão falha fechada',()=>{
  const only=[repos[0]];
  assert.equal(parseAstenAccountAndRepository(identity,only,undefined).repositoryId,5);
  assert.throws(()=>parseAstenAccountAndRepository(identity,[repos[2]],undefined),/Nenhum repositório Asten com permissão/);
  assert.throws(()=>listAuthorizedAstenRepositories({Usuario:{id:'inválido'}},repos),/Usuario.id válido/);
  assert.throws(()=>listAuthorizedAstenRepositories(identity,{Repositorios:repos}),/lista de repositórios esperada/);
});

test('nomes retornados para seleção são curtos e não incluem controles',()=>{
  const catalog=listAuthorizedAstenRepositories(identity,[{id:10,nome:'Pasta\\nProibida'.repeat(50),Usuario:{id:41},isProprietario:'S'}]);
  assert.equal(catalog.repositories.length,1);
  assert.ok(catalog.repositories[0].name.length<=120);
  assert.doesNotMatch(catalog.repositories[0].name,/\\n/);
});
