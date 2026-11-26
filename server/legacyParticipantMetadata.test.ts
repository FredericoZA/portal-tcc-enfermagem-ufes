import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import type {LegacyAcademicRecord} from '../src/types/legacyArchive';
import {academicName} from '../src/utils/personPresentation';
import {legacyRepositoryProcess} from '../src/utils/legacyRepository';
import {buildPublicRepository} from './publicViews';
import {
  canonicalLegacyRecord, mergeLegacyBatch, publicLegacyAcademicView,
  privateLegacyAcademicView, validateLegacyBatch,
} from './legacyArchive';

const fixture = (): LegacyAcademicRecord => ({
  id:'legado-0042', protocolo:'042 - Legado', sourceFingerprint:'a'.repeat(64),
  titulo:'Trabalho histórico demonstrativo', autores:['Autoria de Exemplo'],
  orientador:'Ana Docente Exemplo', advisorAcademic:{tratamento:'Professora', titulacao:'Doutora'},
  coorientador:'Bruno Docente Exemplo', coorientadorInstituicao:'Instituição externa de exemplo',
  coadvisorAcademic:{tratamento:'Professor', titulacao:'Mestre'},
  examinadores:[{nome:'Carla Examinadora Exemplo', instituicao:'Instituição externa de exemplo', tratamento:'Senhora', titulacao:'Especialista'}],
  resumo:'Resumo demonstrativo', palavrasChave:['Ensino'],
  dataDefesa:'2023-06-01', horaDefesa:'14:00:00', localDefesa:'Sala demonstrativa',
  isPublic:false, publishFullWork:false, publishExpandedAbstract:false,
  publicationState:'NOT_REQUESTED', authorizationDecision:'DENIED', attachments:[],
  provenance:{originalConsent:['Não'], participantMetadataReview:{source:'Fonte demonstrativa', privateNote:'Evidência privada demonstrativa'}},
});

test('reviewed participant metadata survives import, hydration and a JSON backup round trip without changing publication', () => {
  const source = fixture();
  const before = structuredClone(source);
  const [record] = validateLegacyBatch([source]);
  assert.deepEqual(record.advisorAcademic, source.advisorAcademic);
  assert.deepEqual(record.coadvisorAcademic, source.coadvisorAcademic);
  assert.deepEqual(record.examinadores, source.examinadores);
  assert.deepEqual(canonicalLegacyRecord(record), record);
  assert.deepEqual(validateLegacyBatch(JSON.parse(JSON.stringify([record]))), [record]);
  assert.deepEqual(mergeLegacyBatch([record], validateLegacyBatch([record])), [record]);
  assert.deepEqual(source, before);

  const view = publicLegacyAcademicView(record);
  const process = legacyRepositoryProcess(view);
  assert.equal(academicName(process.orientador, 'abbreviated'), 'Prof.ª Dr.ª Ana Docente Exemplo');
  assert.equal(academicName(process.coorientador, 'abbreviated'), 'Prof. Me. Bruno Docente Exemplo');
  assert.equal(academicName(process.banca[0], 'abbreviated'), 'Sra. Esp. Carla Examinadora Exemplo');
  assert.equal(process.coorientador?.instituicao, source.coorientadorInstituicao);
  assert.equal(process.banca[0].instituicao, source.examinadores[0].instituicao);
  assert.equal(view.authorizationDecision, 'DENIED');
  assert.deepEqual(view.publicFiles, []);
  assert.deepEqual(privateLegacyAcademicView(record).files, []);
  assert.equal('provenance' in view, false);
  assert.equal('email' in view.examinadores[0], false);
  assert.equal('funcao' in view.examinadores[0], false);
});

test('explicit metadata takes precedence per field while omitted fields retain recorded source evidence', () => {
  const record = fixture();
  record.orientador = 'Prof.ª Me. Ana Docente Exemplo';
  record.advisorAcademic = {titulacao:'Doutora'};
  record.coorientador = 'Prof. Dr. Bruno Docente Exemplo';
  record.coadvisorAcademic = {tratamento:'Professor', titulacao:'Sem titulação'};
  record.examinadores = [{nome:'Prof.ª Dr.ª Carla Examinadora Exemplo', instituicao:'Instituição externa de exemplo', tratamento:'Senhora', titulacao:'Especialista'}];
  const view = publicLegacyAcademicView(record);
  assert.deepEqual(view.advisorAcademic, {tratamento:'Professora', titulacao:'Doutora'});
  assert.deepEqual(view.coadvisorAcademic, {tratamento:'Professor', titulacao:'Sem titulação'});
  assert.equal(academicName(view.examinadores[0], 'abbreviated'), 'Sra. Esp. Carla Examinadora Exemplo');
  assert.equal(view.examinadores[0].instituicao, 'Instituição externa de exemplo');

  const process = legacyRepositoryProcess(view);
  assert.equal(process.coorientador?.tratamento, 'Professor');
  assert.equal(academicName(process.coorientador, 'abbreviated'), 'Prof. Bruno Docente Exemplo');
});

test('legacy import rejects invalid academic structures, noncanonical enums and injected role fields', () => {
  const invalid = [
    null, false, 1, 'Doutora', [], [{titulacao:'Doutora'}],
    {tratamento:'Master'}, {tratamento:'Aluno'}, {tratamento:''}, {tratamento:null}, {tratamento:1},
    {titulacao:'PhD'}, {titulacao:'Doutora '}, {titulacao:''}, {titulacao:null},
    {titulacao:{value:'Doutora'}}, {titulacao:'Doutora', role:'MASTER'},
    {titulacao:'Doutora', email:'private@example.invalid'},
    JSON.parse('{"__proto__":{"role":"MASTER"},"titulacao":"Doutora"}'),
    Object.create({titulacao:'Doutora'}),
  ];
  for (const field of ['advisorAcademic','coadvisorAcademic']) {
    for (const value of invalid) assert.throws(() => validateLegacyBatch([{...fixture(), [field]:value}]), /acadêmic/);
    for (const tratamento of ['Senhor','Senhora']) assert.throws(() => validateLegacyBatch([{...fixture(), [field]:{tratamento}}]), /acadêmic/);
  }
  for (const person of [null, false, [], 'Participante',
    {...fixture().examinadores[0], titulacao:'PhD'},
    {...fixture().examinadores[0], tratamento:'MASTER'},
    {...fixture().examinadores[0], funcao:'MASTER'},
    {...fixture().examinadores[0], email:'private@example.invalid'},
  ]) assert.throws(() => validateLegacyBatch([{...fixture(), examinadores:[person]}]), /acadêmic/);
});

test('unknown people receive no inferred doctorate or institution and invalid persisted metadata is not presented', () => {
  const record = fixture();
  delete record.advisorAcademic;
  delete record.coadvisorAcademic;
  record.coorientadorInstituicao = '';
  record.examinadores = [{nome:'Pessoa Externa Demonstrativa', instituicao:''}];
  const view = publicLegacyAcademicView(record);
  assert.equal(view.advisorAcademic, undefined);
  assert.equal(view.coadvisorAcademic, undefined);
  assert.equal(view.coorientadorInstituicao, '');
  assert.deepEqual(view.examinadores, [{nome:'Pessoa Externa Demonstrativa', instituicao:''}]);
  const malformed = publicLegacyAcademicView({
    ...record, advisorAcademic:{tratamento:'MASTER'}, coadvisorAcademic:{titulacao:'PhD'},
    examinadores:[{...record.examinadores[0], tratamento:'MASTER', titulacao:'PhD', email:'private@example.invalid'}],
  } as unknown as LegacyAcademicRecord);
  assert.equal(malformed.advisorAcademic, undefined);
  assert.equal(malformed.coadvisorAcademic, undefined);
  assert.deepEqual(malformed.examinadores, view.examinadores);
});

test('the current SQL repository projection preserves participant metadata and matches the full public view', async () => {
  const db = new PGlite();
  try {
    await db.exec('create role anon; create role authenticated; create role service_role; create table public.portal_runtime_state(id text primary key,revision bigint,payload jsonb);');
    const record = fixture();
    record.provenance.submissionWorkbook = {rows:[{peopleOriginal:{examinadorExterno:'Prof.ª Me. Carla Examinadora Exemplo'}, privateEmail:'private@example.invalid'}]};
    const payload = {processes:[], legacyAcademicRecords:[record]};
    await db.query('insert into public.portal_runtime_state values ($1,42,$2::jsonb)', ['global', JSON.stringify(payload)]);
    await db.exec(await readFile('supabase/migrations/20261125155300_repository_legacy_faculty_evidence.sql', 'utf8'));
    const row = (await db.query<{revision:number; payload:{legacyAcademicRecords:LegacyAcademicRecord[]}}>('select * from public.portal_read_repository_v1()')).rows[0];
    const lean = row.payload.legacyAcademicRecords[0];
    assert.equal(row.revision, 42);
    assert.deepEqual(lean.advisorAcademic, record.advisorAcademic);
    assert.deepEqual(lean.coadvisorAcademic, record.coadvisorAcademic);
    assert.deepEqual(lean.examinadores, record.examinadores);
    assert.deepEqual(publicLegacyAcademicView(canonicalLegacyRecord(lean)), publicLegacyAcademicView(canonicalLegacyRecord(record)));
    assert.deepEqual(buildPublicRepository([], [canonicalLegacyRecord(lean)]), buildPublicRepository([], [canonicalLegacyRecord(record)]));
    assert.equal('participantMetadataReview' in lean.provenance, false);
    assert.equal(JSON.stringify(row.payload).includes('private@example.invalid'), false);
    assert.deepEqual((await db.query<{payload:unknown}>('select payload from public.portal_runtime_state')).rows[0].payload, payload);
    for (const role of ['anon', 'authenticated']) {
      assert.equal((await db.query<{allowed:boolean}>('select has_function_privilege($1,$2,$3) as allowed', [role, 'public.portal_read_repository_v1()', 'EXECUTE'])).rows[0].allowed, false);
    }
  } finally { await db.close(); }
});
