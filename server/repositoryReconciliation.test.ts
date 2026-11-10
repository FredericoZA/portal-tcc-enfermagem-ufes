import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {DEMO_PROCESSES,INITIAL_SETTINGS} from '../src/services/demoSeed';
import {buildPublicRepository,canonicalRepositoryCurrentRecords} from './publicViews';
import {canonicalLegacyRecord} from './legacyArchive';
import {matchesRepositoryQuery,matchesDefenseDateRange} from '../src/utils/repositoryQuery';
import type {ProcessData} from '../src/types';

function record(id:string,patch:Partial<ProcessData>={}):ProcessData{
 const p=structuredClone(DEMO_PROCESSES[0]);
 return {...p,id,protocolo:`TCC - ${id}`,status:'AGUARDANDO_CONFIRMACAO_LOCAL',dataRevision:2,updatedAt:'2026-11-07T12:00:00Z',...patch};
}
function legacy(id='legado-0001',protocol='001 - Legado'){
 return canonicalLegacyRecord({id,protocolo:protocol,sourceFingerprint:'a'.repeat(64),titulo:'Mesmo título',autores:['Autor histórico'],orientador:'Docente histórico',coorientador:'',coorientadorInstituicao:'',examinadores:[],resumo:'Resumo histórico',palavrasChave:[],dataDefesa:'2025-06-01',horaDefesa:'',localDefesa:'',isPublic:false,publishFullWork:false,publishExpandedAbstract:false,publicationState:'NOT_REQUESTED',authorizationDecision:'UNSPECIFIED',attachments:[],provenance:{}});
}

test('repository identity uses source namespaces and explicit revisions, never the title',()=>{
 const current=record('legado-0001'),newer=record('legado-0001',{dataRevision:3,titulo:'Versão atual'}),olderTimestamp=record('legado-0001',{updatedAt:'2026-11-06T12:00:00Z'});
 const otherIdentity=record('different-id',{protocolo:current.protocolo,titulo:current.titulo});
 const historic=legacy('legado-0001');
 const sources=[current,structuredClone(current),olderTimestamp,newer,otherIdentity];const before=structuredClone({sources,historic});
 const selected=canonicalRepositoryCurrentRecords(sources);
 assert.deepEqual(selected.map(row=>row.id),['legado-0001','different-id']);assert.equal(selected[0],newer);
 const result=buildPublicRepository(sources,[historic,structuredClone(historic)]);
 assert.equal(result.length,3,'current identity collision by protocol and legacy namespace are preserved');
 assert.equal(result.filter(row=>'legacyRecord' in row&&row.legacyRecord).length,1);
 assert.deepEqual({sources,historic},before);
 const sameVersionConflict=record(current.id,{titulo:'Conteúdo divergente sem nova revisão'});
 assert.equal(canonicalRepositoryCurrentRecords([current,sameVersionConflict]).length,2,'unresolved content conflict cannot be silently hidden');
 const historicalConflict={...historic,titulo:'Origem histórica divergente'};
 assert.equal(buildPublicRepository([],[historic,historicalConflict]).length,2,'historical record without version clock is deduplicated only if exact');
 const draftLatest=record(current.id,{status:'EM_RASCUNHO',dataRevision:4});
 assert.equal(buildPublicRepository([current,draftLatest],[]).length,0,'older submitted copy does not override authoritative newer draft');
});

test('repository date range excludes unknown or invalid dates without hiding them from the unfiltered listing',()=>{
 const known=record('known'),unknown=record('unknown',{defesa:{startAt:'',endAt:'',local:''}}),invalid=record('invalid',{defesa:{startAt:'2026-02-30',endAt:'',local:''}});
 known.defesa.startAt='2026-11-07T12:00:00Z';known.titulo='Segurança do paciente';known.orientador.instituicao='Universidade Federal do Espírito Santo';
 const all=[known,unknown,invalid],before=structuredClone(all),empty={search:'',startDate:'',endDate:''};
 assert.equal(all.filter(p=>matchesRepositoryQuery(p,empty)).length,3);
 assert.deepEqual(all.filter(p=>matchesRepositoryQuery(p,{...empty,startDate:'2026-11-01',endDate:'2026-11-30'})).map(p=>p.id),['known']);
 assert.equal(matchesRepositoryQuery(known,{...empty,search:'UFES'}),true);assert.equal(matchesRepositoryQuery(known,{...empty,search:'  Segurança  '}),true);
 assert.equal(matchesRepositoryQuery(known,{...empty,startDate:'2026-11-08'}),false);assert.equal(matchesRepositoryQuery(known,{...empty,endDate:'2026-11-06'}),false);
 assert.deepEqual(all,before);
 const midnight=record('midnight',{defesa:{startAt:'2026-11-08T01:30:00Z',endAt:'',local:''}});
 assert.equal(matchesRepositoryQuery(midnight,{...empty,startDate:'2026-11-07',endDate:'2026-11-07'}),true,'UTC early morning belongs to the preceding São Paulo day');
 assert.equal(matchesRepositoryQuery(midnight,{...empty,startDate:'2026-11-08',endDate:'2026-11-08'}),false);
 const civil=record('civil',{defesa:{startAt:'2026-11-07',endAt:'',local:''}});
 assert.equal(matchesRepositoryQuery(civil,{...empty,startDate:'2026-11-07',endDate:'2026-11-07'}),true,'date-only source is a calendar day, not midnight UTC');
 const historicalClock=record('historical',{legacyRecord:true,defesa:{startAt:'2018-11-30T23:30:00-03:00',endAt:'',local:''}});
 assert.equal(matchesRepositoryQuery(historicalClock,{...empty,startDate:'2018-11-30',endDate:'2018-11-30'}),true,'imported legacy hour keeps its source civil day, including former daylight-saving months');
 for(const process of [...all,midnight,civil,historicalClock])for(const [startDate,endDate]of [['',''],['2026-11-07','2026-11-07'],['2018-11-30','2018-11-30']])assert.equal(matchesDefenseDateRange(process,startDate,endDate),matchesRepositoryQuery(process,{search:'',startDate,endDate}),'private and public lists share the exact same date eligibility');
});

test('HTTP repository exposes the same submitted current/legacy projection to visitors, participants and Master', {timeout:45000},async()=>{
 const directory=await mkdtemp(path.join(tmpdir(),'portal-repository-reconciliation-'));
 const pending=record('00001');pending.defesa={...pending.defesa,localStatus:'PENDENTE'};
 const confirmed=record('00002',{status:'AGUARDANDO_DEFESA'});confirmed.defesa={...confirmed.defesa,localStatus:'CONFIRMADO'};
 const completed=record('00003',{status:'CONCLUIDO'});completed.acervo={trabalhoCompletoFileId:'private_drive_reference',trabalhoCompletoSha256:'b'.repeat(64),publishFullWork:false,publicationState:'NOT_REQUESTED',palavrasChave:['Campo público']};
 const draft=record('draft',{status:'EM_RASCUNHO'}),historical=legacy();
 const processes=[{...pending,dataRevision:1,titulo:'Versão anterior'},pending,structuredClone(pending),confirmed,completed,draft],state={settings:INITIAL_SETTINGS,processes,legacyAcademicRecords:[historical,structuredClone(historical)],signatureJobs:[]};
 const stateFile=path.join(directory,'portal-state.json');await writeFile(stateFile,JSON.stringify(state));
 const port=47600+Math.floor(Math.random()*600),base=`http://127.0.0.1:${port}`;
 const environment=Object.fromEntries(['PATH','HOME','TMPDIR','LANG','TZ'].filter(key=>process.env[key]).map(key=>[key,process.env[key]]));
 const child=spawn(process.execPath,['--import','tsx','--input-type=module','-e',"import dotenv from 'dotenv';dotenv.config=()=>({parsed:{}});await import('./server.ts');"],{cwd:process.cwd(),env:{...environment,NODE_ENV:'development',HOST:'127.0.0.1',PORT:String(port),PORTAL_PUBLIC_URL:base,APP_URL:base,PORTAL_DATA_DIR:directory,PORTAL_PERSISTENCE_PROVIDER:'local_file',PORTAL_ALLOW_INSECURE_DEMO_AUTH:'true',PORTAL_ALLOW_LOCAL_OTP_STORE:'true',PORTAL_ALLOW_LOCAL_SECRET_STORE:'true',PORTAL_SESSION_SECRET:'repository-fixture-secret-0123456789abcdef',PORTAL_OTP_PEPPER:'repository-fixture-otp-0123456789abcdef',ASTEN_INTEGRATION_ENABLED:'false',SUPABASE_URL:'',SUPABASE_SECRET_KEY:'',SUPABASE_SERVICE_ROLE_KEY:'',VERCEL:''},stdio:'ignore'});
 try{
  const deadline=Date.now()+20000;while(true){try{if((await fetch(base+'/api/health')).ok)break;}catch{}if(Date.now()>deadline||child.exitCode!==null)throw Error('Servidor não iniciou');await new Promise(resolve=>setTimeout(resolve,100));}
  let canonical:unknown;
  for(const email of ['',pending.aluno1.email,'master@portal.local']){
   const headers=email?{'x-demo-user-email':email}:{};
   for(const suffix of ['', '?status=CONCLUIDO&page=99&limit=1']){
    const response=await fetch(base+'/api/public/repository'+suffix,{headers});assert.equal(response.status,200);assert.match(response.headers.get('cache-control')||'',/no-store/);
    const body=await response.json();
    assert.equal(body.length,4,'client-side pagination/filter parameters cannot omit submitted records in API');
    assert.deepEqual(body.map((p:any)=>p.protocolo),[pending.protocolo,confirmed.protocolo,completed.protocolo,historical.protocolo]);
    assert.equal(body[0].titulo,pending.titulo);assert.equal(body[0].defesa.localStatus,'PENDENTE');assert.equal(body[1].defesa.localStatus,'CONFIRMADO');
    assert.equal(body[2].acervo.fullWorkState,'PRIVATE');assert.equal(body[2].acervo.trabalhoCompletoFileUrl,undefined);
    assert.doesNotMatch(JSON.stringify(body.slice(0,3)),/@|matricula|private_drive_reference|createdByEmail|registrationAnswers/);assert.equal(body[3].aluno1.email,'');assert.equal(body[3].aluno1.matricula,'');assert.doesNotMatch(JSON.stringify(body),/@|private_drive_reference/);
    if(canonical===undefined)canonical=body;else assert.deepEqual(body,canonical,'authentication does not expand public projection');
   }
  }
  const remaining=JSON.parse(await readFile(stateFile,'utf8'));assert.equal(remaining.processes.length,processes.length);assert.equal(remaining.legacyAcademicRecords.length,2,'deduplication changes only projection, not source or archival content');
 }finally{if(child.exitCode===null){const closed=new Promise(resolve=>child.once('exit',resolve));child.kill('SIGTERM');await closed;}await rm(directory,{recursive:true,force:true});}
});
