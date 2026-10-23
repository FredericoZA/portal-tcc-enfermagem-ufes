type AdmissionFailureCode='RUNTIME_REQUEST_QUEUE_FULL'|'RUNTIME_REQUEST_QUEUE_TIMEOUT'|'RUNTIME_REQUEST_CANCELED';
export class RuntimeRequestAdmissionError extends Error {
  readonly status=503;
  readonly retryAfterSeconds=5;
  constructor(readonly code:AdmissionFailureCode){
    super('O Portal está ocupado. Tente novamente em alguns segundos.');
    this.name='RuntimeRequestAdmissionError';
  }
}

interface RuntimeRequestQueueOptions {
  maxWaiting?:number;
  waitTimeoutMs?:number;
  now?:()=>number;
  schedule?:(callback:()=>void,delayMs:number)=>unknown;
  cancel?:(timer:unknown)=>void;
}

/** Keeps one instance's mutable runtime stable, with bounded FIFO admission.
 * Cancellation removes a waiter only. Once granted, a lease is released solely
 * by its owner after the protected work finishes, never by an abort or timer. */
export function createRuntimeRequestQueue(options:RuntimeRequestQueueOptions={}) {
  const maxWaiting=options.maxWaiting??32;
  const waitTimeoutMs=options.waitTimeoutMs??5_000;
  if(!Number.isSafeInteger(maxWaiting)||maxWaiting<0||!Number.isSafeInteger(waitTimeoutMs)||waitTimeoutMs<=0)throw new Error('Limites de admissão inválidos.');
  const now=options.now||Date.now;
  const schedule=options.schedule||((callback,delay)=>setTimeout(callback,delay));
  const cancel=options.cancel||(timer=>clearTimeout(timer as ReturnType<typeof setTimeout>));
  type Waiter={state:'WAITING'|'GRANTED'|'CANCELED';expiresAt:number;signal?:AbortSignal;abort?:()=>void;timer?:unknown;resolve:(release:()=>void)=>void;reject:(error:RuntimeRequestAdmissionError)=>void};
  const waiting:Waiter[]=[];
  let active=false;

  const cleanup=(waiter:Waiter)=>{
    if(waiter.timer!==undefined)cancel(waiter.timer);
    waiter.timer=undefined;
    if(waiter.abort)waiter.signal?.removeEventListener('abort',waiter.abort);
  };
  const rejectWaiter=(waiter:Waiter,code:AdmissionFailureCode)=>{
    if(waiter.state!=='WAITING')return;
    waiter.state='CANCELED';
    const index=waiting.indexOf(waiter);
    if(index!==-1)waiting.splice(index,1);
    cleanup(waiter);
    waiter.reject(new RuntimeRequestAdmissionError(code));
  };
  const createLease=():()=>void=>{
    let released=false;
    return()=>{
      if(released)return;
      released=true;
      active=false;
      while(waiting.length){
        const waiter=waiting[0];
        if(waiter.signal?.aborted){rejectWaiter(waiter,'RUNTIME_REQUEST_CANCELED');continue;}
        if(waiter.expiresAt<=now()){rejectWaiter(waiter,'RUNTIME_REQUEST_QUEUE_TIMEOUT');continue;}
        waiting.shift();
        waiter.state='GRANTED';
        cleanup(waiter);
        active=true;
        waiter.resolve(createLease());
        return;
      }
    };
  };
  return (signal?:AbortSignal):Promise<()=>void>=>{
    if(signal?.aborted)return Promise.reject(new RuntimeRequestAdmissionError('RUNTIME_REQUEST_CANCELED'));
    if(!active){active=true;return Promise.resolve(createLease());}
    if(waiting.length>=maxWaiting)return Promise.reject(new RuntimeRequestAdmissionError('RUNTIME_REQUEST_QUEUE_FULL'));
    return new Promise((resolve,reject)=>{
      const waiter:Waiter={state:'WAITING',expiresAt:now()+waitTimeoutMs,signal,resolve,reject};
      waiting.push(waiter);
      waiter.timer=schedule(()=>rejectWaiter(waiter,'RUNTIME_REQUEST_QUEUE_TIMEOUT'),waitTimeoutMs);
      if(signal){
        waiter.abort=()=>rejectWaiter(waiter,'RUNTIME_REQUEST_CANCELED');
        signal.addEventListener('abort',waiter.abort,{once:true});
        if(signal.aborted)waiter.abort();
      }
    });
  };
}

/** A failed previous response must not poison the next fresh database read.
 * Call only under the request lock, then reload authoritative state before use. */
export function settlePreviousRuntimeWrites(pending:Promise<void>):Promise<void>{
  return pending.catch(()=>undefined);
}
