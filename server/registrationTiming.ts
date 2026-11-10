import type {IncomingMessage,ServerResponse} from 'node:http';

type Stage='queue_wait'|'previous_writes'|'hydrate'|'apply_state'|'draft_commit'|'protocol_lookup'|'process_commit';
interface RegistrationTiming {measure:(stage:Stage)=>()=>void;}
const timings=new WeakMap<object,RegistrationTiming>();
const rounded=(value:number)=>Math.round(Math.max(0,Math.min(value,86_400_000))*10)/10;

export function registrationRequestTiming(request:object):RegistrationTiming|undefined{return timings.get(request);}

/** Fixed registration routes only. Never retain URL queries, headers, identities or bodies.
 * total starts at runtime admission, after JSON parsing; it is not browser latency. */
export function beginRegistrationRequestTiming(
  request:IncomingMessage&{path:string},response:ServerResponse,
  now:()=>number=()=>performance.now(),
  report:(value:{route:string;status:number;timings:Record<string,number>})=>void=value=>console.info('[Registration timing]',JSON.stringify(value)),
):RegistrationTiming|undefined{
  const route=request.method==='GET'&&request.path==='/registration/bootstrap'?'GET /api/registration/bootstrap'
    :request.method==='PUT'&&request.path==='/registration/draft'?'PUT /api/registration/draft'
    :request.method==='POST'&&request.path==='/processes'?'POST /api/processes':undefined;
  if(!route)return;
  const existing=timings.get(request);if(existing)return existing;
  const started=now(),durations:Partial<Record<Stage,number>>={};
  const snapshot=()=>({...durations,total:rounded(now()-started)});
  const timing:RegistrationTiming={measure:stage=>{
    const began=now();let ended=false;
    return()=>{if(ended)return;ended=true;durations[stage]=rounded((durations[stage]||0)+now()-began);};
  }};
  timings.set(request,timing);
  const writeHead=response.writeHead;
  response.writeHead=function(...args:Parameters<ServerResponse['writeHead']>){
    if(!this.headersSent)this.setHeader('Server-Timing',Object.entries(snapshot()).map(([name,value])=>`${name};dur=${value}`).join(', '));
    return writeHead.apply(this,args);
  } as ServerResponse['writeHead'];
  response.once('finish',()=>{timings.delete(request);if(route==='POST /api/processes')return;try{report({route,status:response.statusCode,timings:snapshot()});}catch{/* Timing must never interrupt a completed business response. */}});
  response.once('close',()=>{timings.delete(request);});
  return timing;
}
