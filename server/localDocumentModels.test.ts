import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {localDocumentModelsEnabled,storeLocalDocumentModel,readLocalDocumentModel} from './localDocumentModels';

test('armazenamento local exige as três condições locais e nunca funciona na Vercel/produção',()=>{
  const env={NODE_ENV:'development',PORTAL_PERSISTENCE_PROVIDER:'local_file',PORTAL_TEST_DOCUMENT_RENDERER:'true'};
  assert.equal(localDocumentModelsEnabled(env),true);
  for(const override of [{NODE_ENV:'production'},{VERCEL:'1'},{PORTAL_PERSISTENCE_PROVIDER:'supabase'},{PORTAL_TEST_DOCUMENT_RENDERER:'false'}])assert.equal(localDocumentModelsEnabled({...env,...override}),false);
});
test('DOCX local mantém bytes e rejeita troca de arquivo, hash e caminhos arbitrários',()=>{
  const before={...process.env};const directory=mkdtempSync(path.join(tmpdir(),'portal-model-'));
  try{
    Object.assign(process.env,{NODE_ENV:'development',PORTAL_PERSISTENCE_PROVIDER:'local_file',PORTAL_TEST_DOCUMENT_RENDERER:'true'});delete process.env.VERCEL;
    const bytes=Buffer.from('PK-fixture');const model=storeLocalDocumentModel(directory,'teste.docx',bytes);
    assert.deepEqual(readLocalDocumentModel(directory,model.id,model.contentSha256),bytes);
    assert.throws(()=>readLocalDocumentModel(directory,'../../outro',model.contentSha256),/inválida/);
    assert.throws(()=>readLocalDocumentModel(directory,model.id,'0'.repeat(64)),/inválida/);
    writeFileSync(path.join(directory,'modelos-locais',`${model.contentSha256}.docx`),'alterado');
    assert.throws(()=>readLocalDocumentModel(directory,model.id,model.contentSha256),/integridade/);
  }finally{process.env=before;rmSync(directory,{recursive:true,force:true});}
});
