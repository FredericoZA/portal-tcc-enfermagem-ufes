import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAcademicKeyword } from '../src/utils/academicTextCase';
import { displayParticipantInstitution, normalizeInstitutionInput } from '../src/utils/institutionName';
import { legacyRepositoryProcess } from '../src/utils/legacyRepository';
import { academicName } from '../src/utils/personPresentation';
import {validateLegacyBatch,mergeLegacyBatch,legacyCatalogRevision,publicLegacyAcademicView,privateLegacyAcademicView,canonicalLegacyRecord,legacyFileIsPublic} from './legacyArchive';

export const legacyFixture = () => ({
  id:'legado-0001',protocolo:'Legado 001',sourceFingerprint:'a'.repeat(64),titulo:'Trabalho histórico',autores:['Autora demonstrativa'],orientador:'Professor demonstrativo',coorientador:'',coorientadorInstituicao:'',examinadores:[],resumo:'Resumo de origem',palavrasChave:['Enfermagem'],dataDefesa:'2023-06-01',horaDefesa:'14:00:00',localDefesa:'Auditório',isPublic:false,publishFullWork:false,publishExpandedAbstract:false,publicationState:'NOT_REQUESTED',authorizationDecision:'DENIED',attachments:[{driveFileId:'private_file_123456',fileName:'arquivo.pdf',kind:'TRABALHO_COMPLETO',sha256:'b'.repeat(64),evidence:'Título e autoria conferidos'}],provenance:{publicationImportBaseline:{publicFiles:[{kind:'TRABALHO_COMPLETO',sha256:'b'.repeat(64)}]},originalConsent:['Não'],sourceUrl:'https://example.invalid/source'}
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

test('legacy hydration preserves physical names, source basenames, author order, IDs, hashes and consent after a Drive rename',()=>{
  const input={...legacyFixture(),autores:['Zélia Maria Almeida','Ana Luísa Pereira']};
  input.attachments[0]={...input.attachments[0],fileName:'06 - Trabalho completo - Ana Luísa e Zélia Maria - v01.pdf',sourceFileName:'envio_original.pdf'} as any;
  const before=structuredClone(input);
  const record=canonicalLegacyRecord(input as any);
  assert.deepEqual(record.attachments,before.attachments);
  assert.deepEqual(record.autores,before.autores);
  assert.deepEqual(record.provenance,before.provenance);
  assert.equal(record.id,before.id);
  assert.deepEqual(canonicalLegacyRecord(record),record);
  assert.deepEqual(input,before);
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
  assert.deepEqual(publicLegacyAcademicView(hydrated).examinadores, [
    expected[0], {...expected[1], tratamento:'Professora', titulacao:'Doutora'},
  ]);
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
  const authorized = canonicalLegacyRecord({...fixture,provenance:{...fixture.provenance,originalConsent:['Sim']}} as any);
  assert.equal(validateLegacyBatch([authorized])[0].publishFullWork,true);
  const publicView=publicLegacyAcademicView(authorized);
  assert.equal(publicView.publicFiles.length,1);
  assert.ok(!JSON.stringify(publicView).includes('private_file_123456'));
  const summaryOnly=canonicalLegacyRecord({...authorized,provenance:{...authorized.provenance,publicationImportBaseline:{publicFiles:[{kind:'RESUMO_EXPANDIDO',sha256:'b'.repeat(64)}]}},attachments:[{...authorized.attachments[0],kind:'RESUMO_EXPANDIDO'}]});
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

test('historical withdrawal overrides publication without rewriting original consent evidence',()=>{
 const original=canonicalLegacyRecord({...legacyFixture(),provenance:{...legacyFixture().provenance,originalConsent:['Sim']}} as any);
 const withdrawn=canonicalLegacyRecord({...original,provenance:{...original.provenance,publicationWithdrawal:{withdrawnAt:'2026-11-15T00:00:00Z',drivePending:true}}});
 assert.deepEqual(withdrawn.provenance.originalConsent,['Sim']);assert.equal(withdrawn.publishFullWork,false);assert.deepEqual(publicLegacyAcademicView(withdrawn).publicFiles,[]);assert.equal(privateLegacyAcademicView(withdrawn).publicationWithdrawal?.drivePending,true);
});

test('public historical document policy excludes evaluation instruments and keeps Drive references private',async()=>{
 const {publicLegacyAdministrativeDocuments}=await import('./legacyArchive');const record=canonicalLegacyRecord(legacyFixture() as any);
 const kinds=['CONVITE','ATA','TERMO','DECLARACAO','AVALIACAO'];record.provenance.administrativeDocuments=kinds.map((kind,i)=>({driveFileId:'private_admin_file_'+i,folderId:'private_folder_123456',fileName:kind+'.pdf',sha256:'a'.repeat(64),kind,visibility:'PRIVATE_ADMINISTRATIVE_DOCUMENT'}));
 (record.provenance.administrativeDocuments as any[]).push({driveFileId:record.attachments[0].driveFileId,folderId:'private_folder_123456',fileName:'misclassified.pdf',sha256:record.attachments[0].sha256,kind:'ATA',visibility:'PRIVATE_ADMINISTRATIVE_DOCUMENT'});
 const documents=publicLegacyAdministrativeDocuments(record);assert.deepEqual(documents.map(d=>d.type),kinds.slice(1,4));assert.doesNotMatch(JSON.stringify(documents),/private_admin|private_folder|AVALIACAO/);
});

test('signed consolidation preserves issued routes and exposes each current document once', async () => {
  const { legacyAdministrativeRoutes, publicLegacyAdministrativeDocuments } = await import('./legacyArchive');
  const record = canonicalLegacyRecord(legacyFixture() as any);
  const file = { kind: 'ATA', folderId: 'private_folder_123456', fileName: 'ata.pdf', sha256: 'c'.repeat(64), visibility: 'PRIVATE_ADMINISTRATIVE_DOCUMENT' };
  const signed = 'signed_file_123456', evaluation = 'evaluation_file_123456', next = 'new_file_123456';
  record.provenance.administrativeDocuments = [
    { ...file, driveFileId: evaluation, kind: 'AVALIACAO' },
    { ...file, driveFileId: signed },
    { ...file, driveFileId: next, kind: 'TERMO' },
  ];
  record.provenance.administrativeRouteFileIds = [signed, evaluation, signed];
  const routes = legacyAdministrativeRoutes(record);
  assert.deepEqual(routes.map(r => r.aliases), [[1], [0, 2], [3]]);
  assert.deepEqual(publicLegacyAdministrativeDocuments(record).map(d => d.id), ['legacy-document-0', 'legacy-document-3']);
});

test('legacy faculty display uses the matched catalog row and archived internal roles',()=>{
  const [record]=validateLegacyBatch([{
    ...legacyFixture(), orientador:'Fábio Lúcio Tavares',
    examinadores:[
      {nome:'Daniela Vieira Malta',instituicao:''},
      {nome:'Aline Piovezan Entringer',instituicao:'Instituição externa'},
      {nome:'Mirian Fioresi',instituicao:''},
    ],
    provenance:{
      ...legacyFixture().provenance,
      pageUrl:'https://enfermagem.vitoria.ufes.br/pt-br/trabalhos-de-conclusao-de-curso-defendidos',
      pageRecords:[{
        advisorOriginal:'Prof. Dr. Fábio Lúcio Tavares', defenseDate:'2023-06-01',
        titleOriginal:'TRABALHO HISTÓRICO', authorsOriginal:'Autora demonstrativa',
      }],
      repositoryExaminerRoles:[{examinadorInterno:'Daniela Vieira Malta - Aline Piovezan Entringer -'}],
    },
  }]);
  const initial=structuredClone(record);
  const publicView=publicLegacyAcademicView(record);
  assert.deepEqual(publicView.advisorAcademic,{tratamento:'Professor',titulacao:'Doutor'});
  assert.equal(publicView.examinadores[0].instituicao,'Universidade Federal do Espírito Santo');
  assert.equal(publicView.examinadores[1].instituicao,'Instituição externa');
  assert.equal(publicView.examinadores[2].instituicao,'');
  assert.equal('provenance' in publicView,false);
  assert.deepEqual(record,initial);
  const correction={
    ...record,
    dataDefesa:'2023-06-02',
    provenance:{...record.provenance,repositoryExaminerRoles:[
      {examinadorInterno:'Daniela Vieira Malta',examinadorExterno:'Daniela Vieira Malta'},
    ]},
  };
  const conflicting=publicLegacyAcademicView(correction);
  assert.equal(conflicting.advisorAcademic,undefined);
  assert.equal(conflicting.examinadores[0].instituicao,'');
});

test('institution labels preserve CAPS service levels and use verified abbreviations', () => {
  for (const [label, expected] of [
    ['Caps I', 'CAPS I'],
    ['CAPS Ii', 'CAPS II'],
    ['CAPS Iii', 'CAPS III'],
    ['Caps Ad Iii – Vitória', 'CAPS AD III – Vitória'],
    ['Hospital Cassiano Antônio de Moraes (UCAM)', 'HUCAM'],
    ['Hospital Universitário Cassiano Antônio Moraes', 'HUCAM'],
    ['Hospital Estadual Infantil Nossa Senhora da Glória', 'HEINSG'],
    ['Hospital Regional Dom Moura', 'HRDM'],
    ['Universidade Federal de Pelotas', 'UFPel'],
    ['Secretaria Municipal de Saúde São Mateus - ES', 'SMS – São Mateus'],
    ['Hospital Dom Malan', 'Hospital Dom Malan'],
  ]) assert.equal(displayParticipantInstitution(label), expected, label);
  assert.equal(normalizeInstitutionInput('Caps Ad Iii'), 'CAPS AD III');
});

test('public keywords correct uppercase phrases while retaining acronyms and original archive values', () => {
  const keywords = ['SAÚDE MENTAL', 'ACESSO AO SUS', 'SUS E HIV-1', 'VIGILÂNCIA NO CAPS Iii', 'PrEP e covid-19', 'pH sanguíneo', 'e-SUS'];
  const expected = ['Saúde mental', 'Acesso ao SUS', 'SUS e HIV-1', 'Vigilância no CAPS III', 'PrEP e COVID-19', 'pH sanguíneo', 'e-SUS'];
  assert.deepEqual(keywords.map(normalizeAcademicKeyword), expected);
  assert.deepEqual(expected.map(normalizeAcademicKeyword), expected);
  const [record] = validateLegacyBatch([{...legacyFixture(), palavrasChave:keywords}]);
  assert.deepEqual(publicLegacyAcademicView(record).palavrasChave, expected);
  assert.deepEqual(privateLegacyAcademicView(record).palavrasChave, keywords);
  const rowsFromRepository = [
    {
      palavrasChave:['câncer de mama', 'ações do enfermeiro', 'educação em saúde'],
      expected:'Câncer de mama • Ações do enfermeiro • Educação em saúde',
    },
    {
      palavrasChave:['COVID-19', 'RAÇA', 'COR', 'GÊNERO', 'ANÁLISE DE DADOS'],
      expected:'COVID-19 • Raça • Cor • Gênero • Análise de dados',
    },
    {
      palavrasChave:['INFECÇÃO POR ZIKA VÍRUS', 'ANORMALIDADES CARDIOVASCULARES', 'CARDIOLOGIA'],
      expected:'Infecção por zika vírus • Anormalidades cardiovasculares • Cardiologia',
    },
    {
      palavrasChave:['COVID- 19', 'Enfermagem', 'Ensino online', 'Pandemia', 'Aprendizagem'],
      expected:'COVID-19 • Enfermagem • Ensino online • Pandemia • Aprendizagem',
    },
  ];
  for (const {palavrasChave, expected} of rowsFromRepository) {
    assert.equal(publicLegacyAcademicView({...record, palavrasChave}).palavrasChave.join(' • '), expected);
  }
});

test('legacy participants recover verified affiliations and documented treatments', () => {
  const [record] = validateLegacyBatch([{
    ...legacyFixture(),
    orientador:'Marcia Valéria de Souza Almeida',
    coorientador:'Secretaria Municipal de Saúde São Mateus',
    examinadores:[
      {nome:'Luciana de Cássia N. Nascimento', instituicao:''},
      {nome:'Marcia Valéria de Souza Almeida', instituicao:'Não informado'},
      {nome:'Nome de Exemplo', instituicao:''},
      {nome:'Pessoa de Exemplo', instituicao:''},
      {nome:'Outra Pessoa', instituicao:''},
    ],
    provenance:{
      ...legacyFixture().provenance,
      repositoryExaminerRoles:[
        {examinadorExterno:'Sra. Me. Nome de Exemplo; Dr. Pessoa de Exemplo; Prof. Dr. Outra Pessoa'},
        {examinadorExterno:'Prof. Me. Outra Pessoa'},
      ],
    },
  }]);
  const process = legacyRepositoryProcess(publicLegacyAcademicView(record));
  assert.match(academicName(process.orientador, 'abbreviated'), /^Prof\.ª Dr\.ª /);
  assert.equal(academicName(process.banca[0], 'abbreviated'), 'Prof.ª Dr.ª Luciana de Cássia Nunes Nascimento');
  assert.equal(academicName(process.banca[1], 'abbreviated'), 'Prof.ª Dr.ª Márcia Valéria de Souza Almeida');
  assert.deepEqual(process.banca.slice(0,2).map(p => displayParticipantInstitution(p.instituicao || '')), ['UFES', 'UFES']);
  assert.equal(academicName(process.banca[2], 'abbreviated'), 'Sra. Me. Nome de Exemplo');
  assert.equal(academicName(process.banca[3], 'abbreviated'), 'Dr. Pessoa de Exemplo');
  assert.equal(academicName(process.banca[4], 'abbreviated'), 'Prof. Outra Pessoa');
  assert.equal(process.coorientador?.nome, '');
  assert.equal(displayParticipantInstitution(process.coorientador?.instituicao || ''), 'SMS – São Mateus');
  const earlier = legacyRepositoryProcess(publicLegacyAcademicView({...record, dataDefesa:'2015-01-01'}));
  assert.equal(earlier.banca[0].titulacao, undefined);
  const external = publicLegacyAcademicView({...record, examinadores:[{nome:record.examinadores[0].nome, instituicao:'UnB'}]});
  assert.equal(external.examinadores[0].instituicao, 'UnB');
  const coadvisor = legacyRepositoryProcess(publicLegacyAcademicView({...record, coorientador:'Luciana de Cássia Nunes Nascimento'}));
  assert.equal(academicName(coadvisor.coorientador, 'abbreviated'), 'Prof.ª Dr.ª Luciana de Cássia Nunes Nascimento');
});

test('legacy catalog standardizes the department and the auditorium while retaining specific venues', () => {
  const [record] = validateLegacyBatch([legacyFixture()]);
  const publicLocation = (localDefesa: string) => publicLegacyAcademicView({...record, localDefesa}).localDefesa;
  const department = 'Departamento de Enfermagem - CCS UFES';
  const auditorium = 'Auditório do Prédio do Departamento de Enfermagem - CCS UFES';
  for (const location of [
    'Vitória', 'Vitória-ES', 'UFES', 'Departamento de Enfermagem',
    'Departamento de Enfermagem da Universidade Federal do Espírito Santo',
    'Universidade Federal do Espírito Santo, Campus Maruípe',
    'Av. Marechal Campos, nº 1468, Maruípe, Vitória-ES, CEP - Santos Dumont, Vitória - ES, 29047-105',
    department,
  ]) assert.equal(publicLocation(location), department, location);
  for (const location of [
    'Auditório', 'Auditório de Enfermagem - Departamento de Enfermagem UFES',
    'Auditório do Departamento de Enfermage/UFES/CCS',
    'Auditório, Departamento de Enfermagem, Centro de Ciências da Saúde, Universidade Federal do Espírito Santo',
    'Universidade Federal do Espírito Santo - CCS Maruípe / Auditório Departamento de Enfermagem',
    'Auditório do Prédio do Departamento de Enfermagem - CCS/UFES',
    auditorium,
  ]) assert.equal(publicLocation(location), auditorium, location);
  for (const location of [
    'Sala 2', 'Sala de reuniões do Departamento de Enfermagem', 'Auditório PPGSC',
    'UFES (via plataforma digital Google Meet)', 'Google Meet', 'Labepi - Departamento de Enfermagem',
    'Universidade Federal do Espírito Santo - Prédio do Departamento de Enfermagem Sala 01',
    'Hospital das Clínicas, Avenida Marechal Campos', 'UFES Campus de Alegre', '',
  ]) assert.equal(publicLocation(location), location);
  const original = {...record, localDefesa:'UFES'};
  publicLegacyAcademicView(original);
  assert.equal(original.localDefesa, 'UFES');
});
