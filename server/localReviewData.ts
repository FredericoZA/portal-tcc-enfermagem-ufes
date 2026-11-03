import {DEMO_PROCESSES,DEMO_MEMBERSHIPS} from '../src/services/demoSeed';
import type {ProcessData,ProcessMembership} from '../src/types';

/** Opt-in localhost fixtures. Never replace existing processes or contact providers. */
export function localReviewData(state:{processes?:ProcessData[];memberships?:ProcessMembership[]},env:Record<string,string|undefined>,now=new Date()):{processes:ProcessData[];memberships:ProcessMembership[]}|null{
 if(env.NODE_ENV!=='development'||env.VERCEL||env.PORTAL_PERSISTENCE_PROVIDER!=='local_file'||env.PORTAL_LOCAL_REVIEW_DATA!=='true'||env.PORTAL_ALLOW_INSECURE_DEMO_AUTH!=='true'||env.PORTAL_TEST_DOCUMENT_RENDERER!=='true')return null;
 if(env.PORTAL_DATA_DIR&&env.PORTAL_LOCAL_REVIEW_DATA_CUSTOM_DIR!=='true')return null;
 if(state.processes?.length)return null;
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'numeric'}).formatToParts(now);
 const year=Number(parts.find(p=>p.type==='year')!.value),month=Number(parts.find(p=>p.type==='month')!.value)-1;
 const processes=structuredClone(DEMO_PROCESSES).map((process,index)=>{
  const start=new Date(Date.UTC(year,month,1+index,13+index%5));
  while([0,6].includes(start.getUTCDay()))start.setUTCDate(start.getUTCDate()+1);
  const end=new Date(start.getTime()+90*60_000);
  process.titulo=`[Demonstração] ${process.titulo}`;
  process.defesa={...process.defesa,startAt:start.toISOString(),endAt:end.toISOString()};
  return process;
 });
 const ids=new Set((state.memberships||[]).map(item=>item.id));
 return {processes,memberships:[...(state.memberships||[]),...structuredClone(DEMO_MEMBERSHIPS).filter(item=>!ids.has(item.id))]};
}
