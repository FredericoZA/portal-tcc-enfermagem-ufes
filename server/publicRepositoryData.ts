import type {Express} from 'express';
import type {ProcessData} from '../src/types';
import type {LegacyAcademicRecord} from '../src/types/legacyArchive';
import {buildPublicRepository} from './publicViews';
import {canonicalLegacyRecord} from './legacyArchive';
type Snapshot={processes:ProcessData[];legacyAcademicRecords:LegacyAcademicRecord[];revision?:number};
export function createPublicRepositoryReader(ports:{durable:()=>boolean;readRevision:()=>Promise<number|null>;readDurable:()=>Promise<Snapshot>;readLocal:()=>Snapshot}){
 let cached:{revision:number;data:ReturnType<typeof buildPublicRepository>}|undefined;
 let pending:Promise<ReturnType<typeof buildPublicRepository>>|undefined;
 return async()=>{
  if(!pending){const task=Promise.resolve().then(async()=>{
   if(!ports.durable()){cached=undefined;const s=ports.readLocal();return buildPublicRepository(s.processes,s.legacyAcademicRecords.map(canonicalLegacyRecord));}
   const revision=await ports.readRevision();if(!Number.isSafeInteger(revision)||!revision)throw Error('Revisão não confirmada.');
   if(cached?.revision===revision)return cached.data;
   cached=undefined;const s=await ports.readDurable();
   if(!Number.isSafeInteger(s.revision)||!s.revision)throw Error('Catálogo não confirmado.');
   const data=buildPublicRepository(s.processes,s.legacyAcademicRecords.map(canonicalLegacyRecord));cached={revision:s.revision,data};return data;
  });pending=task;void task.finally(()=>{if(pending===task)pending=undefined;}).catch(()=>undefined);}
  return structuredClone(await pending);
 };
}
export function installPublicRepositoryRoute(app:Pick<Express,'get'>,read:()=>Promise<ReturnType<typeof buildPublicRepository>>){
 app.get('/api/public/repository',async(_req,res)=>{res.setHeader('Cache-Control','no-store');try{res.json(await read());}catch{res.setHeader('Retry-After','5');res.status(503).json({error:'Não foi possível carregar o repositório.',code:'PUBLIC_REPOSITORY_UNAVAILABLE'});}});
}
