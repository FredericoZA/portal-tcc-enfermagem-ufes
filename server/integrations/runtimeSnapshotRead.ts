import {performance} from 'node:perf_hooks';

/** A transport retry cannot authorize stale state, malformed JSON or an HTTP rejection. */
export function snapshotTransportFailure(error:unknown):'TIMEOUT'|'TRANSPORT'|null{
 if(!error||typeof error!=='object')return null;
 const value=error as {name?:unknown;message?:unknown;cause?:{code?:unknown}};
 if(value.name==='TimeoutError'||value.name==='AbortError')return 'TIMEOUT';
 const code=String(value.cause?.code||'');
 if(['UND_ERR_CONNECT_TIMEOUT','UND_ERR_HEADERS_TIMEOUT','UND_ERR_BODY_TIMEOUT','ETIMEDOUT'].includes(code))return 'TIMEOUT';
 if(['UND_ERR_SOCKET','ECONNRESET','EAI_AGAIN','ENETUNREACH','ECONNREFUSED'].includes(code))return 'TRANSPORT';
 return value.name==='TypeError'&&/^(?:fetch failed|terminated|Failed to fetch|NetworkError when attempting to fetch resource\.?|Load failed)$/.test(String(value.message||''))?'TRANSPORT':null;
}
export class SnapshotReadFailure extends Error{
 readonly code:string;
 readonly stage='SNAPSHOT';
 constructor(kind:'TIMEOUT'|'TRANSPORT',cause?:unknown){
  super(kind==='TIMEOUT'?'A leitura segura do estado do Portal excedeu o prazo.':'A conexão foi interrompida durante a leitura segura do estado do Portal.',{cause});
  this.code=`SUPABASE_SNAPSHOT_${kind}`;
 }
}
export class RuntimeSnapshotReadBudget{
 private readonly deadline:number;
 private readonly attempts=new Map<string,number>();
 private lastUrl='';
 private recovered=false;
 constructor(private readonly now=()=>performance.now(),private readonly pause=(ms:number)=>new Promise<void>(resolve=>setTimeout(resolve,ms))){this.deadline=now()+30_000;}
 assertWithinDeadline(){if(this.deadline-this.now()<1)throw new SnapshotReadFailure('TIMEOUT');}
 canAttempt(url:string){return (this.attempts.get(url)||0)<3;}
 timeout(url:string,requested:number):number{
  const remaining=this.deadline-this.now();
  if(remaining<1)throw new SnapshotReadFailure('TIMEOUT');
  const count=this.attempts.get(url)||0;
  if(count>=3)throw new SnapshotReadFailure('TRANSPORT');
  this.lastUrl=url;this.attempts.set(url,count+1);
  return Math.floor(Math.min(requested,remaining));
 }
 consumeTransportRetry(error:unknown,targetUrl=this.lastUrl):boolean{
  if(!snapshotTransportFailure(error)||this.recovered||this.deadline-this.now()<1||(this.attempts.get(targetUrl)||0)>=3)return false;
  this.recovered=true;return true;
 }
 async backoff(ms:number){await this.pause(Math.max(0,Math.min(ms,this.deadline-this.now())));}
}
/** Includes response-body consumption; validation belongs outside this callback. */
export async function readSnapshotWithTransportRecovery<T>(read:(budget:RuntimeSnapshotReadBudget)=>Promise<T>,budget=new RuntimeSnapshotReadBudget()):Promise<T>{
 while(true){
  try{const result=await read(budget);budget.assertWithinDeadline();return result;}catch(error){
   if(budget.consumeTransportRetry(error)){await budget.backoff(250);continue;}
   const kind=snapshotTransportFailure(error);
   if(kind)throw new SnapshotReadFailure(kind,error);
   throw error;
  }
 }
}
