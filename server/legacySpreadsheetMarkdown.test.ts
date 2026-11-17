import assert from 'node:assert/strict';
import test from 'node:test';
import type {LegacyAcademicRecord,LegacySpreadsheetEvidence} from '../src/types/legacyArchive';
import {buildDriveProcessDataMarkdown} from '../src/utils/driveProcessLayout';
import {DEMO_PROCESSES} from '../src/services/demoSeed';
import {privateLegacyAcademicView,publicLegacyAcademicView} from './legacyArchive';

function fixture():LegacyAcademicRecord {
  const record:LegacyAcademicRecord={
    id:'legado-0001',protocolo:'001 - Legado',sourceFingerprint:'a'.repeat(64),titulo:'Título canônico',autores:['Autora Completa'],
    orientador:'Orientadora Atual',coorientador:'',coorientadorInstituicao:'',examinadores:[{nome:'Examinadora Atual',instituicao:'Instituição atual'}],
    resumo:'Resumo acadêmico atual',palavrasChave:['Uma'],dataDefesa:'2022-01-20',horaDefesa:'14:00',localDefesa:'Sala acadêmica',
    isPublic:false,publishFullWork:false,publishExpandedAbstract:false,publicationState:'NOT_REQUESTED',authorizationDecision:'UNSPECIFIED',attachments:[],provenance:{}
  };
  const source={fileId:'synthetic_sheet_123456',sheet:'Avaliação #1 [fonte]',sheetId:0,row:42,rowSha256:'b'.repeat(64)};
  const match={canonicalId:record.id,sourceFingerprint:record.sourceFingerprint,title:record.titulo,authors:[...record.autores],defenseDate:record.dataDefesa,comparison:'SYNTHETIC_SOURCE',canonicalAuthorOrderPreserved:true};
  const evidence:LegacySpreadsheetEvidence={schemaVersion:1,operationId:'technical-operation-not-for-markdown',importedAt:null,evaluations:[{
    id:'synthetic-evaluation',source,match,groups:[{
      group:'A',evaluator:{roleHeader:'Orientador (1)',name:'Avaliadora da Fonte',column:5,cell:'E42'},
      grades:[{header:'1A',value:'2,50',column:6,cell:'F42'},{header:'2A',value:'3,25',column:7,cell:'G42'}],
      reportedTotal:{header:'Total A',value:'9,90',column:16,cell:'P42'}
    }],reportedSummary:[
      {header:'Média ABC',value:'7,123',column:20,cell:'T42'},
      {header:'Situação',value:'Afirmação de situação histórica',column:21,cell:'U42'},
      {header:'Parecer',value:'Parecer literal **da fonte** <preservado>\nSem recalcular notas.',column:22,cell:'V42'}
    ],interpretation:'SOURCE_REPORTED_ONLY_NO_RECALCULATION_OR_CURRENT_WORKFLOW_DECISION'
  }],conflicts:[{
    id:'synthetic-conflict',source,match,status:'PRESERVE_SOURCE_ASSERTION_DO_NOT_OVERWRITE_CANONICAL',assertions:[
      {fieldPath:['orientador'],canonicalValueAtReview:'Orientadora na revisão anterior',reportedValue:'Orientadora Informada na Fonte',sourceColumns:[{header:'Orientador (1)',column:5,cell:'E42'}],reason:'Nome divergente registrado na fonte.'},
      {fieldPath:['examinadores'],canonicalValueAtReview:[{nome:'Examinadora na revisão anterior',instituicao:'Instituição anterior'}],reportedValue:[{nome:'Examinadora Informada na Fonte'}],sourceColumns:[{header:'Examinador (2)',column:17,cell:'Q42'}],reason:'Banca divergente preservada.'}
    ]
  }]};
  record.provenance.legacySpreadsheetEvidence=evidence;
  return record;
}

test('private Markdown preserves literal source grades, totals and conflicts without calculating or replacing canonical decisions',()=>{
  const record=fixture(),before=structuredClone(record),markdown=buildDriveProcessDataMarkdown(record);
  for(const text of ['## Avaliações históricas da fonte','#### Grupo A','Avaliadora da Fonte','1A — valor informado na fonte:** 2,50',
    'Total A informado na fonte:** 9,90','Média ABC informada na fonte:** 7,123','Situação informada na fonte:** Afirmação de situação histórica',
    'Arquivo de origem (ID):** synthetic\\_sheet\\_123456','Aba de origem:** Avaliação \\#1 \\[fonte\\]','Linha de origem:** 42','F42 (coluna 6)',
    '## Divergências preservadas','Valor atual no Portal:** Orientadora Atual','Valor cadastrado na revisão da fonte:** Orientadora na revisão anterior',
    'Valor informado na fonte:** Orientadora Informada na Fonte','Examinadora Atual — Instituição atual','Examinadora Informada na Fonte'])assert.ok(markdown.includes(text),text);
  assert.ok(markdown.includes('Parecer literal \\*\\*da fonte\\*\\* \\<preservado\\>\n  Sem recalcular notas.'));
  assert.doesNotMatch(markdown,/5,75|5\.75|APROVADO|technical-operation|SYNTHETIC_SOURCE/);
  assert.deepEqual(record,before,'Rendering source assertions cannot change grades, board, advisor or consent');
  record.provenance.legacySpreadsheetEvidence!.importedAt='2026-11-17T23:59:59.000Z';
  record.provenance.legacySpreadsheetEvidence!.operationId='another-technical-operation';
  assert.equal(buildDriveProcessDataMarkdown(record),markdown,'CAS timestamp/operation metadata cannot change the Markdown hash');
});

test('sheet projection whitelists academic fields and excludes contacts, secrets and unrelated provenance',()=>{
  const record=fixture(),evidence=record.provenance.legacySpreadsheetEvidence!;
  Object.assign(record.provenance,{secret:'OUTSIDE_PROVENANCE_SECRET',contacts:{email:'outside@example.invalid'},jobs:[{token:'PRIVATE_JOB_TOKEN'}]});
  Object.assign(evidence,{email:'evidence@example.invalid',refreshToken:'PRIVATE_REFRESH_TOKEN'});
  Object.assign(evidence.evaluations[0].groups[0].evaluator,{email:'evaluator@example.invalid',matricula:'PRIVATE_MATRICULA'});
  evidence.evaluations[0].groups[0].grades.push({header:'Email',value:'GRADE_CONTACT_SECRET',column:8,cell:'H42'});
  evidence.evaluations[0].reportedSummary.push({header:'Token',value:'SUMMARY_TOKEN_SECRET',column:23,cell:'W42'});
  evidence.evaluations[0].reportedSummary[2].value+=' Contato: parecer@example.invalid';
  Object.assign(evidence.conflicts[0].assertions[1].reportedValue[0],{email:'board@example.invalid',secret:'BOARD_SECRET'});
  (evidence.conflicts[0].assertions as unknown[]).push({fieldPath:['verifiedPublicationParticipants','authors','email'],reportedValue:'CONFLICT_CONTACT_SECRET',reason:'SECRET_CONFLICT_REASON'});
  const markdown=buildDriveProcessDataMarkdown(record);
  assert.ok(markdown.includes('contato omitido'));
  assert.doesNotMatch(markdown,/@|PRIVATE_|OUTSIDE_|GRADE_CONTACT_SECRET|SUMMARY_TOKEN_SECRET|BOARD_SECRET|CONFLICT_CONTACT_SECRET|SECRET_CONFLICT_REASON|\[object Object\]/);
  for(const view of [publicLegacyAcademicView(record),privateLegacyAcademicView(record)]){
    assert.doesNotMatch(JSON.stringify(view),/legacySpreadsheetEvidence|reportedSummary|reportedValue|Avaliadora da Fonte|Orientadora Informada na Fonte|PRIVATE_|SECRET|parecer@example/);
  }
});

test('unmatched or unsupported sheet evidence stays out of the mirror and live process Markdown is unchanged',()=>{
  const record=fixture(),evidence=record.provenance.legacySpreadsheetEvidence!;
  evidence.evaluations[0].match.canonicalId='legado-0999';evidence.conflicts[0].match.sourceFingerprint='c'.repeat(64);
  assert.doesNotMatch(buildDriveProcessDataMarkdown(record),/## Avaliações históricas da fonte|## Divergências preservadas/);
  Object.assign(evidence,{schemaVersion:2});
  assert.doesNotMatch(buildDriveProcessDataMarkdown(record),/## Avaliações históricas da fonte|## Divergências preservadas/);
  const live=structuredClone(DEMO_PROCESSES[0]);live.legacyRecord=true;
  const before=buildDriveProcessDataMarkdown(live);
  Object.assign(live,{provenance:fixture().provenance});
  assert.equal(buildDriveProcessDataMarkdown(live),before,'Only the canonical LegacyAcademicRecord source accepts these private sheet sections');
});

test('linear contact omission preserves long source text, punctuation and exact group labels',{timeout:5_000},()=>{
  const record = fixture();
  const evaluation = record.provenance.legacySpreadsheetEvidence!.evaluations[0];
  const longText = 'A'.repeat(50_000);
  evaluation.reportedSummary[2].value = `${longText}\nContatos: (nome+fonte@example.invalid.), outra@example-test.invalid!`;
  evaluation.groups[0].grades.push(
    {header:'10A',value:'10A confirmado',column:8,cell:'H42'},
    {header:'10B',value:'Outro grupo',column:9,cell:'I42'},
    {header:'11A',value:'Fora do intervalo',column:10,cell:'J42'},
  );
  const markdown = buildDriveProcessDataMarkdown(record);
  assert.ok(markdown.includes(`${longText}\n  Contatos: (\\[contato omitido\\].), \\[contato omitido\\]!`));
  assert.ok(markdown.includes('10A confirmado'));
  assert.doesNotMatch(markdown, /Outro grupo|Fora do intervalo|@example/);
});
