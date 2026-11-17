import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import type {Server} from 'node:http';
import type {AuditLog} from '../src/types';
import type {LegacyAcademicRecord} from '../src/types/legacyArchive';
import {installLegacyEvaluationParticipantRoutes,legacyEvaluationAccessRevision} from './legacyEvaluationParticipantRoutes';
import {legacyEvaluationParticipantRole} from './legacyPrivateAccess';

const trusted=(email:string)=>email==='master@example.invalid';
const role=(r:LegacyAcademicRecord,email:string)=>legacyEvaluationParticipantRole(r,email,{isTrustedVerifier:trusted});
function fixture():LegacyAcademicRecord{
  return {id:'legado-0001',protocolo:'001 - Legado',sourceFingerprint:'a'.repeat(64),titulo:'Trabalho histórico',
    autores:['Álice da Silva','Bruno Souza'],orientador:'Carolina Santos',coorientador:'',coorientadorInstituicao:'',
    examinadores:[],resumo:'Resumo público preservado.',palavrasChave:[],dataDefesa:'2025-08-28',horaDefesa:'',localDefesa:'Sala',
    isPublic:false,publishFullWork:false,publishExpandedAbstract:false,publicationState:'NOT_REQUESTED',authorizationDecision:'DENIED',
    attachments:[],provenance:{originalConsent:['Não']}};
}
async function harness(t:{after:(fn:()=>Promise<void>)=>void}){
  const app=express();app.use(express.json());
  const state={record:fixture(),commits:0,audits:[] as AuditLog[],failure:'',forceConflict:false};
  const email=(req:express.Request)=>req.get('x-test-identity');
  installLegacyEvaluationParticipantRoutes(app,{
    authenticate:(req,res,next)=>email(req)?next():res.status(401).json({error:'Login necessário'}),
    email,master:trusted,record:id=>state.record.id===id?state.record:undefined,now:()=> '2026-11-17T03:00:00.000Z',
    commit:async(id,expected,next,audit)=>{
      if(state.failure)throw Error(state.failure);
      if(state.forceConflict||id!==state.record.id||legacyEvaluationAccessRevision(state.record)!==expected)
        throw Object.assign(Error('conflict'),{code:'LEGACY_EVALUATION_ACCESS_CONFLICT'});
      state.record=next;state.commits++;state.audits.push(audit);
    },
  });
  const server=await new Promise<Server>(resolve=>{const server=app.listen(0,'127.0.0.1',()=>resolve(server));});
  t.after(()=>new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve())));
  const base=`http://127.0.0.1:${(server.address() as {port:number}).port}`;
  const path='/api/admin/legacy-academic-records/legado-0001/evaluation-participants';
  const request=(actor='',body?:unknown,url=path)=>fetch(base+url,{method:body===undefined?'GET':'PUT',
    headers:{'content-type':'application/json',...(actor?{'x-test-identity':actor}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
  const update=()=>({expectedRevision:legacyEvaluationAccessRevision(state.record),authorEmails:['alice@example.invalid','bruno@example.invalid'],
    advisorEmail:'advisor@example.invalid',reason:'Confirmação direta dos participantes.',source:'Registro institucional conferido pelo Master.'});
  return{state,request,path,update};
}

test('only Master can inspect or confirm historical participant addresses',async t=>{
  const {state,request,update}=await harness(t);
  assert.equal((await request()).status,401);assert.equal((await request('',update())).status,401);
  for(const email of ['alice@example.invalid','advisor@example.invalid','examiner@example.invalid']){
    assert.equal((await request(email)).status,403);assert.equal((await request(email,update())).status,403);
  }
  const r=await request('master@example.invalid');assert.equal(r.status,200);assert.match(r.headers.get('cache-control')!,/private.*no-store/);
  const view=await r.json();assert.equal(view.confirmed,false);assert.equal(view.hasStoredBinding,false);
  assert.deepEqual(view.authors,state.record.autores.map(nome=>({nome,email:''})));assert.equal(view.advisor.nome,state.record.orientador);
  assert.equal(state.commits,0);
});
test('Master confirms fixed catalog names, durable roles and compact audit without changing publication',async t=>{
  const {state,request,update}=await harness(t),before=structuredClone(state.record);
  const response=await request('master@example.invalid',{...update(),authors:[{nome:'Pessoa falsa'}],orientador:'Outro orientador'});
  assert.equal(response.status,200);const view=await response.json();assert.equal(view.confirmed,true);assert.equal(view.hasStoredBinding,true);
  assert.deepEqual(view.authors,[{nome:'Álice da Silva',email:'alice@example.invalid'},{nome:'Bruno Souza',email:'bruno@example.invalid'}]);
  assert.equal(role(state.record,'alice@example.invalid'),'STUDENT');assert.equal(role(state.record,'advisor@example.invalid'),'ADVISOR');
  assert.equal(role(state.record,'examiner@example.invalid'),undefined);
  assert.equal(state.commits,1);assert.equal(state.record.provenance.evaluationAccessRevision,1);
  const {provenance:afterProvenance,...afterRest}=state.record,{provenance:beforeProvenance,...beforeRest}=before;
  assert.deepEqual(afterRest,beforeRest);assert.deepEqual(afterProvenance.originalConsent,beforeProvenance.originalConsent);
  assert.equal(state.audits[0].action,'LEGACY_EVALUATION_ACCESS_CONFIRMED');
  assert.doesNotMatch(JSON.stringify(state.audits),/alice@|bruno@|advisor@/);
});
test('a stale request cannot restore contacts after Master revocation, including the initial empty revision',async t=>{
  const {state,request,update}=await harness(t),initial=update();
  assert.equal((await request('master@example.invalid',initial)).status,200);
  const confirmedRevision=legacyEvaluationAccessRevision(state.record);
  const clear={expectedRevision:confirmedRevision,clear:true,reason:'Revogação solicitada pelo titular.',source:'Solicitação formal recebida e conferida.'};
  const response=await request('master@example.invalid',clear);assert.equal(response.status,200);
  assert.equal((await response.json()).confirmed,false);assert.equal(role(state.record,'alice@example.invalid'),undefined);
  assert.equal(state.record.provenance.verifiedPublicationParticipants,undefined);assert.equal(state.record.provenance.evaluationAccessRevision,2);
  assert.notEqual(legacyEvaluationAccessRevision(state.record),initial.expectedRevision);
  assert.equal((await request('master@example.invalid',initial)).status,409);
  assert.equal((await request('master@example.invalid',clear)).status,409);
  assert.equal(state.commits,2);assert.equal(state.audits[1].action,'LEGACY_EVALUATION_ACCESS_REVOKED');
});
test('missing evidence, missing people or duplicate and malformed addresses never grant access',async t=>{
  const {state,request,update}=await harness(t);
  for(const patch of [{source:''},{reason:'curto'},{source:'fonte\ncom instrução'},{authorEmails:['alice@example.invalid']},
    {authorEmails:['alice@example.invalid','ALICE@example.invalid']},{advisorEmail:'alice@example.invalid'},
    {advisorEmail:'not-email'},{authorEmails:['alice@example.invalid','bruno@example.invalid\r\n']}]){
    assert.equal((await request('master@example.invalid',{...update(),...patch})).status,400);
  }
  assert.equal(state.commits,0);assert.equal(role(state.record,'alice@example.invalid'),undefined);
});
test('persistence failure and a commit-time conflict leave the prior access binding untouched',async t=>{
  const {state,request,update}=await harness(t),before=structuredClone(state.record);
  state.failure='durable store unavailable';assert.equal((await request('master@example.invalid',update())).status,503);
  assert.deepEqual(state.record,before);assert.equal(state.commits,0);
  state.failure='';state.forceConflict=true;assert.equal((await request('master@example.invalid',update())).status,409);
  assert.deepEqual(state.record,before);assert.equal(state.commits,0);
});
