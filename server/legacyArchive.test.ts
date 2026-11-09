import test from 'node:test';
import assert from 'node:assert/strict';
import {validateLegacyBatch,mergeLegacyBatch,legacyCatalogRevision,publicLegacyAcademicView,privateLegacyAcademicView,canonicalLegacyRecord,legacyFileIsPublic} from './legacyArchive';

export const legacyFixture = () => ({
  id:'legado-0001',protocolo:'Legado 001',sourceFingerprint:'a'.repeat(64),titulo:'Trabalho histórico',autores:['Autora demonstrativa'],orientador:'Professor demonstrativo',coorientador:'',coorientadorInstituicao:'',examinadores:[],resumo:'Resumo de origem',palavrasChave:['Enfermagem'],dataDefesa:'2023-06-01',horaDefesa:'14:00:00',localDefesa:'Auditório',isPublic:false,publishFullWork:false,publishExpandedAbstract:false,publicationState:'NOT_REQUESTED',authorizationDecision:'DENIED',attachments:[{driveFileId:'private_file_123456',fileName:'arquivo.pdf',kind:'TRABALHO_COMPLETO',sha256:'b'.repeat(64),evidence:'Título e autoria conferidos'}],provenance:{originalConsent:['Não'],sourceUrl:'https://example.invalid/source'}
});
test('legacy import denies publication without consent, and strips workflow injection',()=>{
  const [r]=validateLegacyBatch([{...legacyFixture(),status:'CONCLUIDO',createdByEmail:'secret@example.invalid',signatureJobs:[{provider:'ASTEN'}]}]);
  assert.equal(r.publishFullWork,false);assert.equal('status' in r,false);assert.equal('signatureJobs' in r,false);assert.equal('createdByEmail' in r,false);
  for(const key of ['isPublic','publishFullWork','publishExpandedAbstract'])assert.throws(()=>validateLegacyBatch([{...legacyFixture(),[key]:true}]));
  assert.throws(()=>validateLegacyBatch([{...legacyFixture(),publicationState:'PUBLIC'}]));
});
test('public legacy projection includes catalog text but excludes consent evidence, source URLs and private Drive references',()=>{
  const [r]=validateLegacyBatch([legacyFixture()]);const json=JSON.stringify(publicLegacyAcademicView(r));
  for(const secret of ['private_file_123456','arquivo.pdf','sourceUrl','originalConsent'])assert.ok(!json.includes(secret));
  assert.equal(JSON.parse(json).resumo,r.resumo);
  assert.equal(JSON.parse(json).filesRestricted,true);
});
test('Master academic view exposes private contents without changing publication consent or storage references',()=>{
  const [record]=validateLegacyBatch([legacyFixture()]);
  const before=structuredClone(record);
  const view=privateLegacyAcademicView(record);
  assert.equal(view.resumo,'Resumo de origem');
  assert.equal(view.files[0].isPublic,false);
  assert.match(view.files[0].downloadUrl,/^\/api\/admin\/legacy-academic-records\/legado-0001\/files\/0\/download$/);
  assert.ok(!JSON.stringify(view).includes('private_file_123456'));
  assert.ok(!JSON.stringify(view).includes('originalConsent'));
  assert.deepEqual(record,before);
  assert.deepEqual(publicLegacyAcademicView(record).publicFiles,[]);
  assert.equal(publicLegacyAcademicView(record).resumo,record.resumo);
});
test('legacy import is idempotent, preserves stable identifiers and rejects collisions',()=>{
  const batch=validateLegacyBatch([legacyFixture()]);const revision=legacyCatalogRevision(batch);
  assert.deepEqual(mergeLegacyBatch(batch,validateLegacyBatch([legacyFixture()])),batch);
  assert.equal(legacyCatalogRevision(batch),revision);
  assert.throws(()=>mergeLegacyBatch(batch,validateLegacyBatch([{...legacyFixture(),titulo:'Outro título'}])));
  assert.throws(()=>validateLegacyBatch([legacyFixture(),legacyFixture()]));
  assert.throws(()=>validateLegacyBatch([{...legacyFixture(),id:'TCC-2026-0001'}]));
  assert.throws(()=>validateLegacyBatch([{...legacyFixture(),dataDefesa:'2023-02-30'}]));
  assert.throws(()=>validateLegacyBatch([{...legacyFixture(),attachments:[{...legacyFixture().attachments[0],driveFileId:'../../credential'}]}]));
});

test('legacy 011 restores the two documented internal examiners at import and hydration',()=>{
  const grouped = [
    { nome: 'Carolina Maia Martins Sales - Márcia Valéria de Souza Almeida', instituicao: '' },
    { nome: '', instituicao: '' },
  ];
  const input = {
    ...legacyFixture(),
    id: 'legado-0011',
    protocolo: '011 - Legado',
    dataDefesa: '2025-02-21',
    examinadores: grouped,
  };
  const expected = [
    { nome: 'Carolina Maia Martins Sales', instituicao: 'Universidade Federal do Espírito Santo' },
    { nome: 'Márcia Valéria de Souza Almeida', instituicao: 'Universidade Federal do Espírito Santo' },
  ];
  const [imported] = validateLegacyBatch([input]);
  assert.deepEqual(imported.examinadores, expected);
  const hydrated = canonicalLegacyRecord({ ...imported, examinadores: grouped, provenance: input.provenance });
  assert.deepEqual(hydrated, imported);
  assert.deepEqual(publicLegacyAcademicView(hydrated).examinadores, expected);
  assert.deepEqual((hydrated.provenance.legacy011BoardCorrection as { originalExaminers: unknown }).originalExaminers, grouped);
  assert.ok(!('provenance' in publicLegacyAcademicView(hydrated)));
  assert.deepEqual(canonicalLegacyRecord(hydrated), hydrated);
  assert.deepEqual(mergeLegacyBatch([hydrated], validateLegacyBatch([input])), [hydrated]);

  const [unrelated] = validateLegacyBatch([{ ...input, id: 'legado-0012', protocolo: '012 - Legado' }]);
  assert.deepEqual(unrelated.examinadores, grouped);
  const changedBoard = [grouped[0], { nome: 'Docente Externa', instituicao: 'Outra universidade' }];
  const [independentCorrection] = validateLegacyBatch([{ ...input, examinadores: changedBoard }]);
  assert.deepEqual(independentCorrection.examinadores, changedBoard);
});

test('legacy consent authorizes only available files and supports missing full TCC',()=>{
  const fixture = legacyFixture();
  const authorized = canonicalLegacyRecord({...fixture,provenance:{originalConsent:['Sim']}} as any);
  assert.equal(validateLegacyBatch([authorized])[0].publishFullWork,true);
  const publicView=publicLegacyAcademicView(authorized);
  assert.equal(publicView.publicFiles.length,1);
  assert.ok(!JSON.stringify(publicView).includes('private_file_123456'));
  const summaryOnly=canonicalLegacyRecord({...authorized,attachments:[{...authorized.attachments[0],kind:'RESUMO_EXPANDIDO'}]});
  assert.equal(validateLegacyBatch([summaryOnly])[0].publishFullWork,false);
  assert.equal(summaryOnly.publishExpandedAbstract,true);
  const missing=canonicalLegacyRecord({...authorized,attachments:[]});
  assert.equal(validateLegacyBatch([missing])[0].publicationState,'AUTHORIZED');
  assert.equal(missing.isPublic,false);
  for(const values of [['Não'],['Sim','Não'],[],['Talvez']]){
    const denied=canonicalLegacyRecord({...authorized,provenance:{originalConsent:values}});
    assert.equal(legacyFileIsPublic(denied,denied.attachments[0]),false);
    assert.deepEqual(publicLegacyAcademicView(denied).publicFiles,[]);
    assert.equal(publicLegacyAcademicView(denied).resumo,fixture.resumo,'Catalog text does not depend on file consent.');
    assert.throws(()=>validateLegacyBatch([{...denied,isPublic:true}]));
  }
  assert.equal(canonicalLegacyRecord({...fixture,protocolo:'Legado 1'} as any).protocolo,'001 - Legado');
  assert.throws(()=>validateLegacyBatch([{...fixture,id:'legado-1000',protocolo:'Legado 1000'}]));
  assert.equal(validateLegacyBatch([{...fixture,id:'legado-0999',protocolo:'Legado 999'}])[0].protocolo,'999 - Legado');
});

 test('legacy repository uses Portal casing, preserves original sources and does not invent signers', async()=>{
  const {legacyRepositoryProcess}=await import('../src/utils/legacyRepository');
  const {publicProcessDetail}=await import('../src/utils/publicProcessDetail');
  const record=canonicalLegacyRecord({...legacyFixture(),titulo:'EDUCACAO EM SAUDE NO SUS',autores:['MARIA DE SOUZA'],orientador:'ANA DOS SANTOS',provenance:{originalConsent:['Não'],originalTitle:'EDUCACAO EM SAUDE NO SUS'}} as any);
  assert.equal(record.titulo,'Educacao em Saude no SUS');assert.deepEqual(record.autores,['Maria de Souza']);assert.equal(record.orientador,'Ana dos Santos');
  assert.equal(record.provenance.originalTitle,'EDUCACAO EM SAUDE NO SUS');
  const process=legacyRepositoryProcess(publicLegacyAcademicView(record));
  assert.equal(process.legacyRecord,true);assert.equal(process.createdAt,'');assert.equal(process.orientador.titulacao,undefined);
  assert.equal(process.aluno1.email,'');assert.equal(process.aluno1.matricula,'');assert.equal(process.acervo?.trabalhoCompletoFileUrl,undefined);
  assert.deepEqual(publicProcessDetail(process).documents,[]);
  const withPlaceholders={...record,palavrasChave:[' Saúde ', '.', '-', '△△▽▲', 'Nenhuma', 'Educação']};
  assert.deepEqual(publicLegacyAcademicView(withPlaceholders).palavrasChave,['Saúde','Educação']);
  assert.deepEqual(privateLegacyAcademicView(withPlaceholders).palavrasChave,withPlaceholders.palavrasChave);
 });

test('administrative legacy references fail closed and stay outside public projections', async()=>{
  const {legacyAdministrativeFiles}=await import('./legacyArchive');
  const file={driveFileId:'private_admin_123456',folderId:'private_folder_123456',fileName:'ata.pdf',sourceFileName:'original.pdf',sha256:'a'.repeat(64),kind:'ATA',visibility:'PRIVATE_ADMINISTRATIVE_DOCUMENT'};
  const record=legacyFixture();
  const withFiles={...record,provenance:{...record.provenance,administrativeDocuments:[file]}};
  assert.equal(legacyAdministrativeFiles(withFiles)[0].kind,'ATA');
  assert.ok(!JSON.stringify(publicLegacyAcademicView(canonicalLegacyRecord(withFiles as any))).includes('private_admin'));
  for(const patch of [{sha256:'bad'},{sourceFileName:'../ata.pdf'},{fileName:'/ata.pdf'},{visibility:'PUBLIC'},{kind:'UNSUPPORTED'},{driveFileId:'bad'}]){
    assert.throws(()=>legacyAdministrativeFiles({...record,provenance:{administrativeDocuments:[{...file,...patch}]}}));
  }
  assert.throws(()=>legacyAdministrativeFiles({...record,provenance:{administrativeDocuments:[file,file]}}));
});
