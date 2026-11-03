import test from 'node:test';
import assert from 'node:assert/strict';
import {publishReviewedModel} from './reviewedModelPublication';
const model={id:'model',type:'DECLARACAO',label:'Declaração',fileName:'modelo.docx',templateContentText:'',driveFileId:'file-original',driveFileUrl:'https://drive.google.com/file/d/file-original',variables:['<<alunos>>'],uploadedAt:'2026-09-12',uploadedBy:'master@teste.local',contentSha256:'a'.repeat(64),activeVersion:1};
const current={contentSha256:'b'.repeat(64),driveRevisionId:'revision-new',driveModifiedTime:'2026-10-24'};
const review={fileId:model.driveFileId,version:1,sha256:current.contentSha256};
test('modelo revisado publica exatamente a versão vista e preserva histórico sem alterar o original',()=>{
 const next=publishReviewedModel(model,current,review,'master@teste.local','2026-10-24');
 assert.equal(next.activeVersion,2);assert.equal(next.contentSha256,current.contentSha256);
 assert.equal(next.versions![0].contentSha256,model.contentSha256);assert.equal(next.versions![1].driveRevisionId,'revision-new');
 assert.equal(model.activeVersion,1);assert.equal(next.driveFileId,model.driveFileId);
});
test('revisão recusa arquivo trocado, nova publicação e alterações depois da prévia',()=>{
 for(const altered of [{...review,fileId:'another-file'},{...review,version:2},{...review,sha256:'c'.repeat(64)},{...review,sha256:''}])assert.throws(()=>publishReviewedModel(model,current,altered,'master@teste.local','2026-10-24'),/mudou depois da prévia/);
});
