import {test} from 'node:test';
import assert from 'node:assert/strict';
import {publicProcessDetail} from '../src/utils/publicProcessDetail';
import {publicRepositoryView} from './publicViews';
import {DEMO_PROCESSES} from '../src/services/demoSeed';

test('shared public detail uses allowlisted people and only publicly issued document URLs',()=>{
 const source=structuredClone(DEMO_PROCESSES[0]);
 source.orientador.tratamento='Professora'; source.orientador.titulacao='Doutora';
 const view=publicRepositoryView(source);
 const exposed=JSON.stringify(view);
 for(const person of [source.aluno1,source.aluno2,source.orientador,source.coorientador,...source.banca]) {
  if(person?.email)assert.ok(!exposed.includes(person.email));
 }
 const result=publicProcessDetail({...view,documents:[{id:'invitation',type:'CONVITE',status:'DISPONIVEL',version:2,url:'/api/public/invitation.pdf'}]});
 assert.equal(result.process.orientador.nome,source.orientador.nome);
 assert.equal(result.process.orientador.tratamento,'Professora');
 assert.equal(result.process.orientador.titulacao,'Doutora');
 assert.equal(result.process.orientador.email,'');
 assert.equal(result.documents.length,4);
 assert.equal(result.documents[0].driveDownloadUrl,'/api/public/invitation.pdf');
 assert.equal(result.documents[0].currentVersion,2);
 for(const doc of result.documents.slice(1)){
  assert.equal(doc.status,'NAO_DISPONIVEL');assert.equal(doc.driveDownloadUrl,undefined);
 }
 assert.equal(result.process.acervo?.trabalhoCompletoFileUrl,undefined);
});
