import test from 'node:test';import assert from 'node:assert/strict';import {assertLegacyPrivateClassificationConsistency,restoreChangesPublicFiles} from './publicationRestoreGuard';import {canonicalLegacyRecord} from '../legacyArchive';
test('backup restoration cannot orphan public historical copies or republish refused content',()=>{
 const r:any=canonicalLegacyRecord({id:'legado-0001',titulo:'Fixture',autores:['Person'],orientador:'Advisor',coorientador:'',examinadores:[],attachments:[{driveFileId:'source-file-123',fileName:'x.pdf',kind:'TRABALHO_COMPLETO',sha256:'a'.repeat(64)}],provenance:{publicationImportBaseline:{publicFiles:[{kind:'TRABALHO_COMPLETO',sha256:'a'.repeat(64)}]},originalConsent:['Sim']}} as any);
 const b={processes:[],jobs:[],legacy:[r]};assert.equal(restoreChangesPublicFiles(b,{...b,legacy:[structuredClone(r)]}),false);
 assert.equal(restoreChangesPublicFiles(b,{...b,legacy:[]}),true);
 const denied=canonicalLegacyRecord({...r,provenance:{originalConsent:['Não']}});
 assert.equal(restoreChangesPublicFiles(b,{...b,legacy:[denied]}),true);assert.equal(restoreChangesPublicFiles({...b,legacy:[denied]},b),true);
 assert.equal(restoreChangesPublicFiles({processes:[],jobs:[],legacy:[]},b),true);
});

test('pending historical Drive withdrawal survives restoration until cleanup is confirmed',()=>{
 const r:any=canonicalLegacyRecord({id:'legado-0001',titulo:'Fixture',autores:['Person'],orientador:'Advisor',coorientador:'',examinadores:[],attachments:[{driveFileId:'source-file-123',fileName:'x.pdf',kind:'TRABALHO_COMPLETO',sha256:'a'.repeat(64)}],provenance:{originalConsent:['Sim'],publicationWithdrawal:{withdrawnAt:'2026-11-15',reason:'Author request',drivePending:true}}} as any);
 const before={processes:[],jobs:[],legacy:[r]};
 assert.equal(restoreChangesPublicFiles(before,structuredClone(before)),false);
 assert.equal(restoreChangesPublicFiles(before,{...before,legacy:[]}),true);
 assert.equal(restoreChangesPublicFiles(before,{...before,legacy:[{...r,attachments:[]}]}),true);
 assert.equal(restoreChangesPublicFiles(before,{...before,legacy:[{...r,provenance:{...r.provenance,publicationWithdrawal:{...r.provenance.publicationWithdrawal,drivePending:false}}}]}),true);
});

test('current withdrawn publications retain status and source references for Drive retry',()=>{
 const p:any={id:'p',status:'CONCLUIDO',acervo:{publicationState:'WITHDRAWN',publicationWithdrawnAt:'2026-11-15',trabalhoCompletoFileId:'private-source',trabalhoCompletoSha256:'a'.repeat(64),publicFullWorkFileId:'public-reference'}};
 const before={processes:[p],jobs:[],legacy:[]};assert.equal(restoreChangesPublicFiles(before,structuredClone(before)),false);
 assert.equal(restoreChangesPublicFiles(before,{...before,processes:[]}),true);
 assert.equal(restoreChangesPublicFiles(before,{...before,processes:[{...p,acervo:{...p.acervo,publicationState:'NOT_REQUESTED'}}]}),true);
 assert.equal(restoreChangesPublicFiles(before,{...before,processes:[{...p,acervo:{...p.acervo,publicFullWorkFileId:undefined}}]}),true);
});

function administrativeFixture(kind='AVALIACAO',driveFileId='private_evaluation_original_123'){
 return {kind,driveFileId,folderId:'historical_private_folder',fileName:'original.pdf',sha256:'b'.repeat(64),visibility:'PRIVATE_ADMINISTRATIVE_DOCUMENT'};
}
function privateHistoricalFixture(id='legado-0001'):any{
 return canonicalLegacyRecord({id,titulo:'Fixture',autores:['Person'],orientador:'Advisor',coorientador:'',examinadores:[],attachments:[],provenance:{originalConsent:['Não'],publicationImportBaseline:{publicFiles:[],privateFileIds:['private_evaluation_original_123']},administrativeDocuments:[administrativeFixture()]}} as any);
}

test('restore cannot reclassify a private evaluation as a public minutes file',()=>{
 const record=privateHistoricalFixture(),before={processes:[],jobs:[],legacy:[record]};
 const changed=structuredClone(record);
 changed.provenance.publicationImportBaseline.privateFileIds=[];
 changed.provenance.administrativeDocuments[0].kind='ATA';
 assert.equal(restoreChangesPublicFiles(before,{...before,legacy:[changed]}),true);
});

test('restore preserves the historical kind/hash boundary even while its files are private',()=>{
 const record=privateHistoricalFixture();
 record.provenance.publicationImportBaseline.publicFiles=[{kind:'RESUMO_EXPANDIDO',sha256:'a'.repeat(64)}];
 const before={processes:[],jobs:[],legacy:[record]};
 for(const publicFiles of [[],[{kind:'TRABALHO_COMPLETO',sha256:'a'.repeat(64)}],[{kind:'RESUMO_EXPANDIDO',sha256:'c'.repeat(64)}]]){
  const changed=structuredClone(record);changed.provenance.publicationImportBaseline.publicFiles=publicFiles;
  assert.equal(restoreChangesPublicFiles(before,{...before,legacy:[changed]}),true);
 }
 const changed=structuredClone(record);changed.provenance.publicationImportBaseline.privateFileIds=[];
 assert.equal(restoreChangesPublicFiles(before,{...before,legacy:[changed]}),true);
});

test('restore compares public administrative originals by type, file identity and content',()=>{
 const record=privateHistoricalFixture();record.provenance.administrativeDocuments=[administrativeFixture('ATA','public_minutes_original_123')];
 const before={processes:[],jobs:[],legacy:[record]};
 for(const patch of [{kind:'AVALIACAO'},{kind:'DECLARACAO'},{driveFileId:'different_original_file_123'},{sha256:'c'.repeat(64)}]){
  const changed=structuredClone(record);Object.assign(changed.provenance.administrativeDocuments[0],patch);
  assert.equal(restoreChangesPublicFiles(before,{...before,legacy:[changed]}),true);
 }
 const changed=structuredClone(record);changed.provenance.administrativeDocuments=[];
 assert.equal(restoreChangesPublicFiles(before,{...before,legacy:[changed]}),true);
});

test('cosmetic source metadata, document names and ordering do not block a restore',()=>{
 const record=privateHistoricalFixture();
 record.provenance.administrativeDocuments=[administrativeFixture('ATA','public_minutes_original_123'),administrativeFixture('DECLARACAO','public_declaration_original_123')];
 record.provenance.publicationImportBaseline.publicFiles=[{kind:'RESUMO_EXPANDIDO',sha256:'a'.repeat(64)},{kind:'TRABALHO_COMPLETO',sha256:'c'.repeat(64)}];
 record.provenance.publicationImportBaseline.privateFileIds.push('another_private_original_123');
 const before={processes:[],jobs:[],legacy:[record]},changed=structuredClone(record);
 changed.provenance.publicationImportBaseline.publicFiles.reverse();changed.provenance.publicationImportBaseline.privateFileIds.reverse();changed.provenance.publicationImportBaseline.sourceDate='2026-11-03';
 changed.provenance.administrativeDocuments.reverse();changed.provenance.administrativeDocuments[0].fileName='renamed-original.pdf';
 assert.equal(restoreChangesPublicFiles(before,{...before,legacy:[changed]}),false);
});

test('private classification prevails when another record calls an evaluation a public administrative file',()=>{
 const privateRecord=privateHistoricalFixture(),other=privateHistoricalFixture('legado-0002');
 other.provenance.publicationImportBaseline.privateFileIds=[];
 other.provenance.administrativeDocuments=[administrativeFixture('ATA')];
 assert.throws(()=>assertLegacyPrivateClassificationConsistency([privateRecord,other]),/classificado como privado/);
 const before={processes:[],jobs:[],legacy:[privateRecord]};
 assert.equal(restoreChangesPublicFiles(before,{...before,legacy:[privateRecord,other]}),true);
 assert.equal(restoreChangesPublicFiles(before,{...before,legacy:[other]}),true,'omitting the private record cannot erase its restriction');
});

test('private file IDs also prevent another record from publishing the same academic original',()=>{
 const privateRecord=privateHistoricalFixture(),other=canonicalLegacyRecord({...privateHistoricalFixture('legado-0002'),attachments:[{driveFileId:'private_evaluation_original_123',fileName:'academic.pdf',kind:'TRABALHO_COMPLETO',sha256:'a'.repeat(64)}],provenance:{originalConsent:['Sim'],publicationImportBaseline:{publicFiles:[{kind:'TRABALHO_COMPLETO',sha256:'a'.repeat(64)}]},administrativeDocuments:[]}});
 assert.throws(()=>assertLegacyPrivateClassificationConsistency([privateRecord,other]),/classificado como privado/);
 assert.doesNotThrow(()=>assertLegacyPrivateClassificationConsistency([privateRecord]));
});

test('import and restore cannot add public academic originals with old or fabricated strict proof',()=>{
 const record:any=canonicalLegacyRecord({...privateHistoricalFixture('legado-0002'),dataDefesa:'2025-08-28',
  attachments:[{driveFileId:'new_academic_original_123',fileName:'academic.pdf',kind:'TRABALHO_COMPLETO',sha256:'a'.repeat(64)}],
  provenance:{originalConsent:['Sim'],publicationImportBaseline:{publicFiles:[{kind:'TRABALHO_COMPLETO',sha256:'a'.repeat(64)}]},administrativeDocuments:[]}});
 const prior=privateHistoricalFixture();
 for(const strict of [false,true]){
  const incoming=structuredClone(record);
  if(strict){
   const sourceUrl='https://enfermagem.example.invalid/academic.pdf',sourceRowFingerprint='e'.repeat(64),sourcePageRecordId='legado-0037';
   incoming.provenance.publicationImportBaseline={policy:'BODY_ROW_LINK_AND_VERIFIED_KIND_HASH_REQUIRED',cutoffDate:'2025-08-28',publicFiles:[{kind:'TRABALHO_COMPLETO',sha256:'a'.repeat(64),sourceRecordId:incoming.id,sourcePageRecordId,sourceUrl,sourceFileName:'academic.pdf',sourceRowFingerprint}]};
   incoming.provenance.pageRecords=[{legacyId:sourcePageRecordId,sourceFingerprint:sourceRowFingerprint,sourceLinks:[sourceUrl]}];
  }
  assert.equal(canonicalLegacyRecord(incoming).isPublic,true,'the guard must reject even internally coherent fabricated proof');
  assert.throws(()=>assertLegacyPrivateClassificationConsistency([prior,incoming],[prior]),/arquivos acadêmicos privados/);
  assert.equal(restoreChangesPublicFiles({processes:[],jobs:[],legacy:[]},{processes:[],jobs:[],legacy:[incoming]}),true);
 }
});

test('new private academic records and safe public administrative originals remain importable',()=>{
 const record=privateHistoricalFixture('legado-0002');
 record.provenance.administrativeDocuments=[administrativeFixture('ATA','new_public_minutes_original_123')];
 assert.doesNotThrow(()=>assertLegacyPrivateClassificationConsistency([record],[]));
 assert.equal(restoreChangesPublicFiles({processes:[],jobs:[],legacy:[]},{processes:[],jobs:[],legacy:[record]}),false);
});

function historicalBodyProofFixture():any{
 const record=privateHistoricalFixture();
 record.provenance.publicationImportBaseline={
  ...record.provenance.publicationImportBaseline,
  policy:'BODY_ROW_LINK_AND_VERIFIED_KIND_HASH_REQUIRED',cutoffDate:'2025-08-28',
  sourcePageUrl:'https://enfermagem.example.invalid/trabalhos',sourcePageSha256:'d'.repeat(64),
  publicFiles:[{kind:'RESUMO_EXPANDIDO',sha256:'a'.repeat(64),sourceUrl:'https://enfermagem.example.invalid/files/resumo.pdf',sourceRowFingerprint:'e'.repeat(64),sourceFileName:'resumo.pdf',sourceRecordId:record.id,sourcePageRecordId:'legado-0037'}],
 };
 return record;
}

test('restore cannot remove or replace the body-row hyperlink evidence of an approved PDF',()=>{
 const record=historicalBodyProofFixture(),before={processes:[],jobs:[],legacy:[record]};
 const replacements={sourceUrl:'https://enfermagem.example.invalid/files/outro.pdf',sourceRowFingerprint:'f'.repeat(64),sourceFileName:'outro.pdf',sourceRecordId:'legado-0002',sourcePageRecordId:'legado-0030'};
 for(const [field,value] of Object.entries(replacements)){
  for(const replacement of [value,undefined]){
   const changed=structuredClone(record);changed.provenance.publicationImportBaseline.publicFiles[0][field]=replacement;
   assert.equal(restoreChangesPublicFiles(before,{...before,legacy:[changed]}),true,`preserve ${field}`);
  }
 }
});

test('restore preserves body-link policy, cutoff and page identity even for currently private PDFs',()=>{
 const record=historicalBodyProofFixture(),before={processes:[],jobs:[],legacy:[record]};
 const replacements={policy:'HISTORICAL_SOURCE_ONLY',cutoffDate:'2025-08-29',sourcePageUrl:'https://enfermagem.example.invalid/another-page',sourcePageSha256:'f'.repeat(64)};
 for(const [field,value] of Object.entries(replacements)){
  for(const replacement of [value,undefined]){
   const changed=structuredClone(record);changed.provenance.publicationImportBaseline[field]=replacement;
   assert.equal(restoreChangesPublicFiles(before,{...before,legacy:[changed]}),true,`preserve ${field}`);
  }
 }
});

test('body-link proof order and cosmetic annotations do not change the restore boundary',()=>{
 const record=historicalBodyProofFixture();
 const proof=record.provenance.publicationImportBaseline.publicFiles[0];
 record.provenance.publicationImportBaseline.publicFiles.push({...proof,kind:'TRABALHO_COMPLETO',sha256:'c'.repeat(64),sourceUrl:'https://enfermagem.example.invalid/files/tcc.pdf',sourceFileName:'tcc.pdf'});
 const before={processes:[],jobs:[],legacy:[record]},changed=structuredClone(record);
 const baseline=changed.provenance.publicationImportBaseline;
 baseline.publicFiles.reverse();baseline.publicFiles[0]={...baseline.publicFiles[0],label:'Título atualizado'};
 baseline.sourceDate='2026-11-17';baseline.changelog='Revisão da descrição';
 assert.equal(restoreChangesPublicFiles(before,{...before,legacy:[changed]}),false);
});

function historicalReaderFixture():any{
 const record=privateHistoricalFixture();record.provenance.evaluationAccessRevision=2;
 record.provenance.verifiedPublicationParticipants={verifiedBy:'master@example.invalid',authors:[{nome:record.autores[0],email:'author@example.invalid'}],advisor:{nome:record.orientador,email:'advisor@example.invalid'},verifiedAt:'2026-11-17T00:00:00Z',verificationReason:'Conferência do documento original',verificationSource:'Ficha histórica assinada'};
 return record;
}
test('restore cannot replace or remove verified historical readers or their monotonic access revision',()=>{
 const record=historicalReaderFixture(),before={processes:[],jobs:[],legacy:[record]};
 const changes=[
  (r:any)=>{delete r.provenance.verifiedPublicationParticipants;},
  (r:any)=>{r.provenance.verifiedPublicationParticipants.authors[0].email='other@example.invalid';},
  (r:any)=>{r.provenance.verifiedPublicationParticipants.authors[0].nome='Another Person';},
  (r:any)=>{r.provenance.verifiedPublicationParticipants.advisor.email='other-advisor@example.invalid';},
  (r:any)=>{r.provenance.verifiedPublicationParticipants.advisor.nome='Another Advisor';},
  (r:any)=>{r.provenance.verifiedPublicationParticipants.verifiedBy='other-master@example.invalid';},
  (r:any)=>{r.provenance.evaluationAccessRevision=1;},
  (r:any)=>{r.provenance.evaluationAccessRevision=3;},
  (r:any)=>{delete r.provenance.evaluationAccessRevision;},
  (r:any)=>{r.autores[0]='Another Person';},
  (r:any)=>{r.orientador='Another Advisor';},
 ];
 for(const mutate of changes){const changed=structuredClone(record);mutate(changed);assert.equal(restoreChangesPublicFiles(before,{...before,legacy:[changed]}),true);}
});
test('clearing historical readers cannot be undone by an older backup or counter reset',()=>{
 const old=historicalReaderFixture(),cleared=structuredClone(old);delete cleared.provenance.verifiedPublicationParticipants;cleared.provenance.evaluationAccessRevision=3;
 const before={processes:[],jobs:[],legacy:[cleared]};
 assert.equal(restoreChangesPublicFiles(before,{...before,legacy:[old]}),true);
 const reset=structuredClone(cleared);delete reset.provenance.evaluationAccessRevision;
 assert.equal(restoreChangesPublicFiles(before,{...before,legacy:[reset]}),true);
 assert.equal(restoreChangesPublicFiles(before,structuredClone(before)),false);
});
test('reader evidence annotations and equivalent casing do not change historical access',()=>{
 const record=historicalReaderFixture(),before={processes:[],jobs:[],legacy:[record]},changed=structuredClone(record);
 changed.provenance.verifiedPublicationParticipants.verifiedAt='2026-11-18T00:00:00Z';
 changed.provenance.verifiedPublicationParticipants.verificationReason='Descrição corrigida da conferência';
 changed.provenance.verifiedPublicationParticipants.verificationSource='Referência corrigida da fonte';
 changed.provenance.verifiedPublicationParticipants.authors[0].nome=' PERSON ';
 changed.provenance.verifiedPublicationParticipants.authors[0].email=' AUTHOR@EXAMPLE.INVALID ';
 assert.equal(restoreChangesPublicFiles(before,{...before,legacy:[changed]}),false);
 const empty=privateHistoricalFixture(),noContacts={processes:[],jobs:[],legacy:[empty]},nullContacts=structuredClone(empty);
 nullContacts.provenance.verifiedPublicationParticipants=null;
 assert.equal(restoreChangesPublicFiles(noContacts,{...noContacts,legacy:[nullContacts]}),false);
});

test('reader ordering preserves the catalog-to-contact pairing while joint reordering is cosmetic',()=>{
 const record=historicalReaderFixture();record.autores.push('Second Person');
 record.provenance.verifiedPublicationParticipants.authors.push({nome:'Second Person',email:'second@example.invalid'});
 const before={processes:[],jobs:[],legacy:[record]};
 for(const onlyCatalog of [true,false]){
  const changed=structuredClone(record);
  (onlyCatalog?changed.autores:changed.provenance.verifiedPublicationParticipants.authors).reverse();
  assert.equal(restoreChangesPublicFiles(before,{...before,legacy:[changed]}),true);
  assert.equal(restoreChangesPublicFiles({...before,legacy:[changed]},before),true,'restore cannot activate a conflicting binding');
 }
 const reordered=structuredClone(record);reordered.autores.reverse();reordered.provenance.verifiedPublicationParticipants.authors.reverse();
 assert.equal(restoreChangesPublicFiles(before,{...before,legacy:[reordered]}),false);
});

test('restore cannot normalize malformed reader identity evidence into an accepted binding',()=>{
 const record=historicalReaderFixture(),before={processes:[],jobs:[],legacy:[record]};
 const changes=[
  (r:any)=>{r.provenance.verifiedPublicationParticipants.authors[0].nome=' '.repeat(1001)+'Person';},
  (r:any)=>{r.autores[0]=' '.repeat(1001)+'Person';},
  (r:any)=>{r.provenance.verifiedPublicationParticipants.authors[0].nome='Person\n';},
  (r:any)=>{r.provenance.verifiedPublicationParticipants.authors[0].email='author@example.invalid\n';},
  (r:any)=>{r.provenance.verifiedPublicationParticipants.verifiedBy='master@example.invalid\n';},
 ];
 for(const mutate of changes){
  const malformed=structuredClone(record);mutate(malformed);
  assert.equal(restoreChangesPublicFiles({...before,legacy:[malformed]},before),true);
 }
});
