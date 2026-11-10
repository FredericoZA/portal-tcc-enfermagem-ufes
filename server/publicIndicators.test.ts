import test from 'node:test';
import assert from 'node:assert/strict';
import type { ProcessData } from '../src/types';
import { buildPublicIndicators } from './publicIndicators';
import {ACADEMIC_PERIOD_FIELD} from '../src/utils/academicPeriod';

import {legacyRepositoryProcess} from '../src/utils/legacyRepository';
import type {PublicLegacyAcademicRecord} from '../src/types/legacyArchive';

const baseProcess = (patch: Partial<ProcessData> = {}): ProcessData => ({
  id: 'p1',
  protocolo: 'TCC-2026-0001',
  titulo: 'Teste',
  etapaAtual: 'CONCLUIDO',
  status: 'CONCLUIDO',
  createdByEmail: 'a@aluno.ufes.br',
  aluno1: { nome: 'Aluno Teste', email: 'a@aluno.ufes.br', matricula: '20260001' },
  aluno2: null,
  orientador: { nome: 'Prof Teste', email: 'p@ufes.br' },
  coorientador: null,
  banca: [],
  defesa: { startAt: '2026-09-10T12:00:00Z', endAt: '2026-09-10T13:30:00Z', local: 'Auditório', localStatus: 'CONFIRMADO' },
  avaliacao: { status: 'CONCLUIDO', resultadoCode: 'APROVADO', resultadoLabel: 'Aprovado', parecer: '' },
  acervo: { publicationState: 'PUBLIC', palavrasChave: ['saúde'], workType: 'ARTIGO', isPublic: true },
  dataRevision: 1,
  createdAt: '2026-08-01T12:00:00Z',
  updatedAt: '2026-09-10T14:00:00Z',
  ...patch,
});

test('indicadores públicos agregam sem expor dados pessoais', () => {
  const processes = Array.from({length:6},(_,i)=>baseProcess({
    id:`p${i+1}`,
    protocolo:`TCC-2026-000${i+1}`,
    aluno1:{ nome:`Aluno ${i+1}`, email:`aluno${i+1}@aluno.ufes.br`, matricula:`2026000${i+1}` },
  }));
  const payload = buildPublicIndicators(processes, Date.parse('2026-09-17T12:00:00Z'));
  assert.equal(payload.totals.registered,6);
  assert.equal(payload.totals.completed,6);
  assert.equal(payload.totals.defended,6);
  assert.equal(payload.privacy.smallGroupSuppressed,false);
  const json=JSON.stringify(payload);
  assert.ok(!json.includes('@aluno.ufes.br'));
  assert.ok(!json.includes('20260001'));
  assert.ok(payload.years.some(item=>item.label==='2026'&&item.count===6));
});

test('período acadêmico declarado é dimensão independente do mês real e não completa históricos',()=>{
  const processes=Array.from({length:12},(_,index)=>baseProcess({
    id:`declared-period-${index}`,
    registrationAnswers:index<3?{[ACADEMIC_PERIOD_FIELD]:'2025-2'}:index<6?{[ACADEMIC_PERIOD_FIELD]:'2027-1'}:index<9?undefined:{[ACADEMIC_PERIOD_FIELD]:'pessoa@example.invalid'},
  }));
  const before=structuredClone(processes);
  const result=buildPublicIndicators(processes,Date.parse('2026-11-07T12:00:00Z'));
  assert.deepEqual(result.academicPeriods,[{label:'2025-2',count:3},{label:'2027-1',count:3},{label:'Não informado',count:6}]);
  assert.deepEqual(result.months,[{label:'2026-09',count:12}]);
  assert.doesNotMatch(JSON.stringify(result),/pessoa@example\.invalid|PERIODO_ACADEMICO_ESTATISTICO/);
  assert.deepEqual(processes,before);
  const small=buildPublicIndicators(processes.slice(0,2),Date.parse('2026-11-07T12:00:00Z'));
  assert.deepEqual(small.academicPeriods,[]);
  const smallBucket=buildPublicIndicators(processes.slice(1),Date.parse('2026-11-07T12:00:00Z'));
  assert.ok(!smallBucket.academicPeriods.some(item=>item.label==='2025-2'));
});

test('indicadores suprimem detalhamento em grupo pequeno', () => {
  const payload = buildPublicIndicators([baseProcess(),baseProcess({id:'p2',protocolo:'TCC-2026-0002'})], Date.parse('2026-09-17T12:00:00Z'));
  assert.equal(payload.privacy.smallGroupSuppressed,true);
  assert.equal(payload.totals.registered,2);
  assert.equal(payload.totals.completed,0);
  assert.deepEqual(payload.byStatus,[]);
  assert.deepEqual(payload.themes,[]);
});


test('API pública não retorna palavras-chave, locais ou resultados com texto livre', () => {
  const secret='IDENTIFICADOR_PESSOAL_TESTE';
  const cases=Array.from({length:8},(_,i)=>baseProcess({
    id:`sig-${i}`,
    protocolo:`TCC-2026-${i+1}`,
    acervo:{ publicationState:'PUBLIC', palavrasChave:[secret], workType:'ARTIGO', isPublic:true },
    defesa:{ startAt:'2026-09-10T12:00:00Z', endAt:'2026-09-10T13:30:00Z', local:secret, localStatus:'CONFIRMADO' },
    avaliacao:{ status:'CONCLUIDO', resultadoCode:'APROVADO', resultadoLabel:secret, parecer:secret },
  }));
  const result=buildPublicIndicators(cases,Date.parse('2026-09-17T12:00:00Z'));
  assert.deepEqual(result.themes,[]);
  assert.deepEqual(result.locations,[]);
  assert.equal(JSON.stringify(result).includes(secret),false);
  assert.ok(result.outcomes.some(row=>row.label==='Aprovado'&&row.count===8));
});

test('mês isolado e única duração de conclusão não são inferíveis na resposta pública', () => {
  const processes=Array.from({length:6},(_,i)=>baseProcess({
    id:`p-${i+1}`,
    defesa:{ startAt:`2026-${String(i+1).padStart(2,'0')}-10T12:00:00Z`, endAt:'', local:'Auditório', localStatus:'CONFIRMADO' },
    completedAt: i===0 ? '2026-01-12T12:00:00Z' : undefined,
  }));
  const result=buildPublicIndicators(processes,Date.parse('2026-11-01T12:00:00Z'));
  assert.equal(result.descriptive,null);
  assert.deepEqual(result.months,[]);
});

test('rótulos de situação inesperados nunca são devolvidos como texto livre', () => {
  const secret='IDENTIDADE_PESSOAL_NAO_CATALOGADA';
  const processes=Array.from({length:6},(_,i)=>baseProcess({id:`n-${i}`,status: secret as ProcessData['status']}));
  const result=buildPublicIndicators(processes,Date.parse('2026-11-01T12:00:00Z'));
  assert.equal(JSON.stringify(result).includes(secret),false);
  assert.deepEqual(result.byStatus,[]);
});

test('nomes reservados de objetos não viram categorias nem interrompem os indicadores',()=>{
  const processes=Array.from({length:6},(_,i)=>baseProcess({id:`prototype-${i}`,acervo:{workType:'constructor' as any},avaliacao:{status:'CONCLUIDO',resultadoCode:'__proto__',resultadoLabel:'Nome Pessoal e matrícula 20260001'}}));
  const result=buildPublicIndicators(processes,Date.parse('2026-11-01T12:00:00Z'));
  assert.deepEqual(result.workTypes,[{label:'Não informado',count:6}]);
  assert.deepEqual(result.outcomes,[]);
  assert.doesNotMatch(JSON.stringify(result),/constructor|__proto__|Nome Pessoal|20260001/);
});

test('legados entram como histórico com somente os PDFs autorizados e sem duração inventada',()=>{
  const records:Array<PublicLegacyAcademicRecord>=Array.from({length:8},(_,i)=>({
    id:`legado-${i}`,protocolo:`${i+1} - Legado`,titulo:`Título pessoal ${i}`,autores:[`Pessoa ${i}`],orientador:'Orientadora',coorientador:'',coorientadorInstituicao:'',examinadores:[],resumo:'Resumo pessoal',palavrasChave:['Palavra pessoal'],dataDefesa:'2025-08-28',horaDefesa:'',localDefesa:'Local pessoal',filesRestricted:i>=6,authorizationDecision:i<6?'AUTHORIZED':'DENIED',publicFiles:i<6?[{index:0,kind:i<3?'TRABALHO_COMPLETO':'RESUMO_EXPANDIDO',downloadUrl:`/api/public/legacy-academic-records/legado-${i}/files/0`}]:[],
  }));
  const processes=records.map(legacyRepositoryProcess),before=structuredClone(processes);
  const result=buildPublicIndicators(processes,Date.parse('2026-11-01T12:00:00Z'));
  assert.equal(result.totals.registered,8);assert.equal(result.totals.completed,8);assert.equal(result.totals.defended,8);assert.equal(result.totals.published,6);
  assert.deepEqual(result.formats,[{label:'Resumo expandido',count:3},{label:'Trabalho completo',count:3}]);
  assert.equal(result.descriptive?.completionDaysMean,null);assert.equal(result.descriptive?.completionDaysMedian,null);
  assert.deepEqual(result.outcomes,[]);assert.deepEqual(processes,before);
  assert.doesNotMatch(JSON.stringify(result),/Título pessoal|Pessoa \d|Resumo pessoal|Local pessoal|legado-|\/api\//);
});

test('uma data passada sem conclusão registrada não comprova que a defesa aconteceu',()=>{
  const processes=Array.from({length:9},(_,i)=>baseProcess({id:`reservation-${i}`,status:'AGUARDANDO_DEFESA',avaliacao:{status:i<3?'CONCLUIDO':'PENDENTE'},defesa:{startAt:'2026-09-10T12:00:00Z',endAt:'2026-09-10T13:30:00Z',local:'Auditório',localStatus:i<3?'CONFIRMADO':i<6?'RECUSADO':'PENDENTE'}}));
  const result=buildPublicIndicators(processes,Date.parse('2026-11-01T12:00:00Z'));
  assert.equal(result.totals.registered,9);assert.equal(result.totals.defended,3);
  assert.deepEqual(result.years,[{label:'2026',count:3}]);
  assert.deepEqual(result.months,[{label:'2026-09',count:3}]);
});

test('data histórica sem horário mantém o dia civil e não inventa turno ou duração',()=>{
  const processes=Array.from({length:6},(_,i)=>baseProcess({id:`date-only-${i}`,legacyRecord:true,createdAt:'',updatedAt:'',defesa:{startAt:'2026-01-01',endAt:'',local:''}}));
  const result=buildPublicIndicators(processes,Date.parse('2026-11-01T12:00:00Z'));
  assert.deepEqual(result.years,[{label:'2026',count:6}]);
  assert.deepEqual(result.months,[{label:'2026-01',count:6}]);
  assert.deepEqual(result.weekdays,[{label:'Quinta-feira',count:6}]);
  assert.deepEqual(result.dayparts,[]);
  assert.equal(result.descriptive?.completionDaysMean,null);
});

test('defesas válidas reconciliam mês, ano, dia e turno em São Paulo',()=>{
  const dates = [
    // Imported day/hour is already São Paulo civil time, including the former DST months.
    { startAt: '2018-11-30T23:30:00-03:00', legacyRecord: true },
    { startAt: '2026-01-01T02:59:00Z', legacyRecord: false },
    { startAt: '2026-01-01T03:00:00Z', legacyRecord: false },
    { startAt: '2026-07-13', legacyRecord: true },
    { startAt: '2026-02-30T12:00:00Z', legacyRecord: false },
    { startAt: '07/01/2026', legacyRecord: false },
    { startAt: '2026-07-14', legacyRecord: true },
  ];
  const processes = dates.flatMap(({ startAt, legacyRecord }, group) => Array.from({ length: 3 }, (_, index) => baseProcess({
    id: `date-group-${group}-${index}`,
    legacyRecord,
    defesa: { startAt, endAt: '', local: '' },
  })));
  const result = buildPublicIndicators(processes, Date.parse('2026-07-13T03:05:00Z'));
  assert.equal(result.totals.defended, 12);
  assert.deepEqual(result.years, [{ label: '2018', count: 3 }, { label: '2025', count: 3 }, { label: '2026', count: 6 }]);
  assert.deepEqual(result.months, [{ label: '2018-11', count: 3 }, { label: '2025-12', count: 3 }, { label: '2026-01', count: 3 }, { label: '2026-07', count: 3 }]);
  assert.ok(result.weekdays.some(row => row.label === 'Sexta-feira' && row.count === 3));
  assert.deepEqual(result.dayparts, [{ label: 'Noite', count: 6 }, { label: 'Manhã', count: 3 }]);
});

test('categorias suprimidas não mudam a base da taxa de conclusão',()=>{
  const completed = Array.from({ length: 108 }, (_, index) => baseProcess({ id: `completed-${index}` }));
  const active = Array.from({ length: 2 }, (_, index) => baseProcess({ id: `active-${index}`, status: 'AGUARDANDO_DEFESA', avaliacao: { status: 'PENDENTE' } }));
  const result = buildPublicIndicators([...completed, ...active], Date.parse('2026-11-01T12:00:00Z'));
  assert.equal(result.totals.registered, 110);
  assert.equal(result.totals.inProgress, 2);
  assert.equal(result.totals.completionRate, 98.2);
  assert.deepEqual(result.byStatus, [{ key: 'CONCLUIDO', label: 'Concluído', count: 108 }]);
});

test('horário futuro no mesmo dia não entra como defesa realizada de um legado',()=>{
  const processes=Array.from({length:6},(_,index)=>baseProcess({
    id:`same-day-${index}`,legacyRecord:true,
    defesa:{startAt:index<3?'2018-11-30T23:30:00-03:00':'2018-11-30T21:30:00-03:00',endAt:'',local:''},
  }));
  // During DST, 00:00Z is 22:00 on the previous civil day in São Paulo.
  const before=buildPublicIndicators(processes,Date.parse('2018-12-01T00:00:00Z'));
  assert.equal(before.totals.defended,3);
  assert.deepEqual(before.months,[{label:'2018-11',count:3}]);
  const after=buildPublicIndicators(processes,Date.parse('2018-12-01T01:31:00Z'));
  assert.equal(after.totals.defended,6);
  assert.deepEqual(after.months,[{label:'2018-11',count:6}]);
});

test('duração inválida não é substituída por zero no tempo médio de conclusão',()=>{
  const processes=Array.from({length:6},(_,i)=>baseProcess({id:`duration-${i}`,createdAt:'2026-01-01T12:00:00Z',completedAt:i<3?'2025-12-31T12:00:00Z':`2026-02-${String((i-3)*10+1).padStart(2,'0')}T12:00:00Z`}));
  const result=buildPublicIndicators(processes,Date.parse('2026-11-01T12:00:00Z'));
  assert.equal(result.descriptive?.completionDaysMean,41);
  assert.equal(result.descriptive?.completionDaysMedian,41);
});

test('estatística mensal usa só grupos divulgados e não revela meses suprimidos por medidas auxiliares',()=>{
  const processes=Array.from({length:6},(_,i)=>baseProcess({id:`monthly-${i}`,defesa:{startAt:`2026-${i<3?'01':i===3?'02':'03'}-10T12:00:00Z`,endAt:'',local:''}}));
  const result=buildPublicIndicators(processes,Date.parse('2026-11-01T12:00:00Z'));
  assert.deepEqual(result.months,[{label:'2026-01',count:3}]);
  assert.equal(result.descriptive?.monthlyMean,3);assert.equal(result.descriptive?.monthlyMedian,3);assert.equal(result.descriptive?.monthlyStdDev,0);assert.equal(result.descriptive?.observedMonths,1);
});

test('IDs residuais não tornam um arquivo privado ou retirado uma publicação',()=>{
  const processes=Array.from({length:6},(_,i)=>baseProcess({id:`private-${i}`,acervo:{publicationState:i<3?'WITHDRAWN':'PENDING_SYNC',isPublic:false,publishFullWork:true,publicFullWorkFileId:'private-residual-id',publicFullWorkFileUrl:'https://drive.example.invalid/private'}}));
  const result=buildPublicIndicators(processes,Date.parse('2026-11-01T12:00:00Z'));
  assert.equal(result.totals.published,0);assert.deepEqual(result.formats,[]);
  assert.doesNotMatch(JSON.stringify(result),/private-residual-id|drive\.example/);
});

test('rascunhos privados não entram no total nem nas taxas públicas', () => {
  const submitted = Array.from({length: 6}, (_, index) => baseProcess({id: `submitted-${index}`}));
  const result = buildPublicIndicators([...submitted, baseProcess({id: 'private-draft', status: 'EM_RASCUNHO'})]);
  assert.equal(result.totals.registered, submitted.length);
  assert.equal(result.totals.completed + result.totals.inProgress, result.totals.registered);
  assert.ok(result.byStatus.every(group => group.key !== 'EM_RASCUNHO'));
});
