import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPublicIndicators} from './publicIndicators';
import {buildTccStatisticalSnapshot} from './statisticalSnapshot';
import {buildAdvancedAnalytics,processPeriod} from './advancedAnalytics';
import {ACADEMIC_PERIOD_FIELD} from '../src/utils/academicPeriod';
import {DEMO_PROCESSES} from '../src/services/demoSeed';
import type {ProcessData} from '../src/types';

const now='2026-11-07T12:00:00Z';
function record(id:string,overrides:Partial<ProcessData>={}):ProcessData{
 const p=structuredClone(DEMO_PROCESSES[0]);
 return {...p,id,protocolo:`TCC - ${id}`,status:'CONCLUIDO',createdAt:'2026-01-01T12:00:00Z',updatedAt:'2026-10-01T12:00:00Z',completedAt:undefined,
  defesa:{...p.defesa,startAt:'2026-01-05T12:00:00Z'},avaliacao:{...p.avaliacao,status:'CONCLUIDO'},...overrides};
}
const analyticsInput=(processes:ProcessData[])=>({processes,formSubmissions:[],workflowRuns:[],emailDeliveries:[],signatureJobs:[],correctionRequests:[],courseName:'Enfermagem',institutionName:'UFES',generatedAt:now});

test('same snapshot reconciles registered, completed, defended, status denominators and documented durations',()=>{
 const processes=[
  ...[10,20,30].map((days,index)=>record(`jan-${index}`,{completedAt:new Date(Date.parse('2026-01-01T12:00:00Z')+days*86400000).toISOString()})),
  ...[0,1,2].map(index=>{const p=record(`feb-${index}`);p.defesa.startAt='2026-02-05T12:00:00Z';return p;}),
  record('legacy',{legacyRecord:true,createdAt:'2025-01-01',completedAt:'2025-12-31',defesa:{startAt:'2025-12-31',endAt:'',local:''}}),
  record('concept',{status:'AGUARDANDO_DADOS_FINAIS',defesa:{startAt:'2026-03-05T12:00:00Z',endAt:'',local:''}}),
  record('scheduled',{status:'AGUARDANDO_DEFESA',avaliacao:{status:'PENDENTE'}}),
  record('future',{completedAt:'2027-01-15T12:00:00Z',defesa:{startAt:'2027-01-05T12:00:00Z',endAt:'',local:''}}),
  record('draft',{status:'EM_RASCUNHO'}),
 ];
 const before=structuredClone(processes),publicReport=buildPublicIndicators(processes,Date.parse(now));
 const privateReport=buildTccStatisticalSnapshot(analyticsInput(processes));
 const advanced=buildAdvancedAnalytics(analyticsInput(processes));
 assert.equal(publicReport.totals.registered,10);assert.equal(privateReport.totals.processes,10);assert.equal(advanced.snapshot.totals.processes,10);
 assert.equal(publicReport.totals.completed,8);assert.equal(privateReport.totals.completed,8);
 assert.equal(publicReport.totals.defended,8);assert.equal(privateReport.totals.defended,8);
 assert.equal(publicReport.totals.completionRate,80);assert.equal(privateReport.rates.completion,80);
 assert.equal(privateReport.distributions.status.entries.reduce((sum,row)=>sum+row.count,0),10);
 assert.deepEqual(publicReport.months,[{label:'2026-01',count:3},{label:'2026-02',count:3}]);
 assert.equal(publicReport.descriptive?.monthlyMean,3);assert.equal(publicReport.descriptive?.monthlyMedian,3);
 assert.equal(publicReport.descriptive?.completionDaysMean,20);assert.equal(publicReport.descriptive?.completionDaysMedian,20);
 assert.equal(privateReport.timing.medianCompletionDays,20);assert.equal(advanced.snapshot.timing.medianCompletionDays,20);
 assert.equal(publicReport.byStatus[0].count,8);assert.equal(publicReport.byStatus[0].count/publicReport.totals.registered*100,80,'suppressed active statuses do not change the denominator');
 assert.deepEqual(processes,before,'statistics must not rewrite source facts');
});

test('academic report uses declared period, preserves explicit cycles and never infers a semester from dates',()=>{
 const declared=record('declared',{registrationAnswers:{[ACADEMIC_PERIOD_FIELD]:'2025-2'},academicCycleId:'2026.1'});
 const explicitCycle=record('cycle',{academicCycleId:'2024.2'});
 const unknown=record('unknown',{academicCycleId:undefined,registrationAnswers:{}});
 assert.equal(processPeriod(declared),'2025-2');assert.equal(processPeriod(explicitCycle),'2024.2');assert.equal(processPeriod(unknown),'SEM_PERIODO');
 const ps=[declared,explicitCycle,unknown,record('draft-period',{status:'EM_RASCUNHO',registrationAnswers:{[ACADEMIC_PERIOD_FIELD]:'2027-2'}})];
 const full=buildAdvancedAnalytics(analyticsInput(ps));
 assert.deepEqual(full.periods,['SEM_PERIODO','2025-2','2024.2']);assert.ok(!full.periods.includes('2027-2'));
 const filtered=buildAdvancedAnalytics(analyticsInput(ps),'2025-2');assert.equal(filtered.snapshot.totals.processes,1);
 assert.match(full.note,/sem dedução pela data da defesa/);
});

test('edit timestamps, missing completion, invalid dates and imported durations never fabricate completion time',()=>{
 for(const patch of [{completedAt:undefined},{completedAt:'invalid'},{completedAt:'2025-12-31T12:00:00Z'},{completedAt:'2027-01-01T12:00:00Z'},{completedAt:'2026-03-01T12:00:00Z',legacyRecord:true}]){
  const processes=Array.from({length:6},(_,index)=>record(String(index),patch));
  assert.equal(buildTccStatisticalSnapshot(analyticsInput(processes)).timing.medianCompletionDays,null);
  assert.equal(buildPublicIndicators(processes,Date.parse(now)).descriptive?.completionDaysMedian,null);
 }
});
