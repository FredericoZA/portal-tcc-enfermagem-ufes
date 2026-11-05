import test from 'node:test';
import assert from 'node:assert/strict';
import type {Request,Response} from 'express';
import {DEMO_PROCESSES} from '../../src/services/demoSeed';
import type {LegacyAcademicRecord} from '../../src/types/legacyArchive';
import {buildPublicIndicatorsFromState} from '../publicIndicators';
import handler from './public-indicators';

const now=Date.parse('2026-11-01T12:00:00Z');
const legacy=(index:number):LegacyAcademicRecord=>({id:`legado-${String(index+1).padStart(4,'0')}`,protocolo:`${String(index+1).padStart(3,'0')} - Legado`,sourceFingerprint:'a'.repeat(64),titulo:'PRIVATE_TITLE_SENTINEL',autores:['PRIVATE_PERSON_SENTINEL'],orientador:'PRIVATE_ADVISOR_SENTINEL',coorientador:'',coorientadorInstituicao:'',examinadores:[],resumo:'PRIVATE_SUMMARY_SENTINEL',palavrasChave:['PRIVATE_KEYWORD_SENTINEL'],dataDefesa:'2025-08-28',horaDefesa:'',localDefesa:'PRIVATE_LOCATION_SENTINEL',isPublic:index<3,publishFullWork:index<3,publishExpandedAbstract:false,publicationState:index<3?'PUBLIC':'NOT_REQUESTED',authorizationDecision:index<3?'AUTHORIZED':'DENIED',provenance:{originalConsent:[index<3?'Sim':'Não']},attachments:[{driveFileId:`private_file_id_${index}`,fileName:'PRIVATE_FILENAME_SENTINEL.pdf',kind:'TRABALHO_COMPLETO',sha256:'b'.repeat(64),evidence:'Original histórico'}]});

async function fixture(run:(f:{invoke:(method?:string)=>Promise<{status:number;body:any;headers:Record<string,string>}>;calls:Array<{url:URL;init:RequestInit}>;rows:Record<string,unknown>[];setFailure:()=>void})=>Promise<void>){
  const keys=['NODE_ENV','VERCEL','PORTAL_PERSISTENCE_PROVIDER','SUPABASE_URL','SUPABASE_SECRET_KEY','SUPABASE_SERVICE_ROLE_KEY'];
  const previous=Object.fromEntries(keys.map(key=>[key,process.env[key]])),originalFetch=globalThis.fetch;
  const calls:Array<{url:URL;init:RequestInit}>=[],rows:Array<Record<string,unknown>>=[{processes:[],legacyAcademicRecords:Array.from({length:6},(_,i)=>legacy(i))}];
  let fail=false;
  Object.assign(process.env,{NODE_ENV:'production',VERCEL:'1',PORTAL_PERSISTENCE_PROVIDER:'supabase',SUPABASE_URL:'https://indicator-db.invalid',SUPABASE_SECRET_KEY:'sb_secret_' + 'synthetic-indicator',SUPABASE_SERVICE_ROLE_KEY:''});
  globalThis.fetch=async(input,init:RequestInit={})=>{
    const url=new URL(typeof input==='string'||input instanceof URL?String(input):input.url);
    calls.push({url,init});
    assert.equal(url.origin,'https://indicator-db.invalid');assert.equal(url.pathname,'/rest/v1/portal_runtime_state');
    return fail?Response.json({error:'PRIVATE_ERROR_SENTINEL'},{status:500}):Response.json(rows);
  };
  const invoke=async(method='GET')=>{
    let status=200,body:unknown;const headers:Record<string,string>={};
    const res={setHeader:(key:string,value:string)=>{headers[key]=value;},status:(value:number)=>{status=value;return res;},json:(value:unknown)=>{body=value;return res;}} as unknown as Response;
    await handler({method,url:'/api/public-indicators',headers:{'x-real-ip':`127.0.0.${fixtureNumber}`},socket:{remoteAddress:'127.0.0.1'}} as unknown as Request,res);
    return {status,body,headers};
  };
  fixtureNumber++;
  try{await run({invoke,calls,rows,setFailure:()=>{fail=true;}});}
  finally{globalThis.fetch=originalFetch;for(const key of keys){if(previous[key]===undefined)delete process.env[key];else process.env[key]=previous[key];}}
}
let fixtureNumber=1;

test('Vercel público lê somente a projeção necessária e produz os mesmos agregados com legados autorizados',async()=>{
  await fixture(async({invoke,calls,rows})=>{
    const process=structuredClone(DEMO_PROCESSES[0]);process.titulo='PRIVATE_CURRENT_TITLE_SENTINEL';
    rows[0].processes=[process];
    const response=await invoke();
    assert.equal(response.status,200);assert.equal(response.body.totals.registered,7);assert.equal(response.body.totals.published,3);
    const expected=buildPublicIndicatorsFromState(rows[0],now);
    assert.deepEqual({...response.body,generatedAt:expected.generatedAt},expected);
    assert.doesNotMatch(JSON.stringify(response.body),/PRIVATE_|private_file|legado-|@|matricula|sourceFingerprint|attachments|resumo|aluno1/);
    assert.match(response.headers['Cache-Control'],/private, no-store/);
    assert.equal(calls.length,1);
    assert.equal(calls[0].url.searchParams.get('select'),'processes:payload->processes,legacyAcademicRecords:payload->legacyAcademicRecords');
    assert.equal(calls[0].init.method,undefined);assert.equal(calls[0].init.cache,'no-store');assert.equal(calls[0].init.redirect,'error');
    assert.deepEqual(calls[0].init.headers,{apikey:'sb_secret_' + 'synthetic-indicator',Accept:'application/json'});
  });
});

test('Vercel indicadores rejeita mutações e configuração ausente antes de ler o banco',async()=>{
  await fixture(async({invoke,calls})=>{
    assert.equal((await invoke('POST')).status,405);assert.equal(calls.length,0);
    process.env.PORTAL_PERSISTENCE_PROVIDER='local_file';
    assert.equal((await invoke()).status,503);assert.equal(calls.length,0);
  });
});

test('Vercel indicadores não expõe falhas do banco nem aceita ausência de estado como acervo vazio',async()=>{
  await fixture(async({invoke,setFailure,rows})=>{
    rows.length=0;
    assert.equal((await invoke()).status,503);
    rows.push({});assert.equal((await invoke()).status,503);
    setFailure();
    const response=await invoke();assert.equal(response.status,503);
    assert.doesNotMatch(JSON.stringify(response.body),/PRIVATE_ERROR_SENTINEL|secret|indicator-db/);
  });
});

test('Vercel indicadores aplica limite de requisições antes do próximo acesso ao banco',async()=>{
  await fixture(async({invoke,calls})=>{
    for(let index=0;index<120;index++)assert.equal((await invoke()).status,200);
    const before=calls.length,response=await invoke();
    assert.equal(response.status,429);assert.equal(calls.length,before);assert.equal(response.body.code,'REQUEST_RATE_LIMITED');assert.ok(Number(response.headers['Retry-After'])>0);
  });
});
