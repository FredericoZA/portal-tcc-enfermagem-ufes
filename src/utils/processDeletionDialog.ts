import type {ProcessDeletionSummary} from '../../server/workflow/processDeletion';
import type {ProcessDeletionStatusResult} from '../../server/workflow/processDeletionStatus';

export type DeletionDialogTarget={id:string;protocol:string;title:string;authors:string};
export type ProcessDeletionResponse={message:string;processId:string;protocol:string;cleanupPending:boolean;cleanupTaskId:string;cleanup:ProcessDeletionSummary;cleanupErrors?:string[];astenPreserved?:number};
export type DeletionDialogState={phase:'confirm'|'pending'|'completed'|'uncertain';busy:boolean;message:string;taskId?:string;cleanup?:ProcessDeletionSummary};
export const initialDeletionDialogState=():DeletionDialogState=>({phase:'confirm',busy:false,message:''});

/** One instance belongs to one authenticated identity and one immutable process ID. */
export function createProcessDeletionSession(target:DeletionDialogTarget,ports:{
 remove:(id:string)=>Promise<ProcessDeletionResponse>;
 read:(id:string,taskId:string|undefined,signal:AbortSignal)=>Promise<ProcessDeletionStatusResult>;
 retry:(taskId:string)=>Promise<ProcessDeletionSummary>;
 change:(state:DeletionDialogState)=>void;
 now?:()=>number;
 rejectsBeforeDelete?:(error:unknown)=>boolean;
}){
 let state=initialDeletionDialogState(),active=true,generation=0;
 let deletionMayBeRunning=false;
 let readController:AbortController|undefined;
 const now=()=>ports.now?.()??Date.now();
 const update=(next:DeletionDialogState,scope:number)=>{
  if(!active||generation!==scope)return;
  state=next;ports.change({...state});
 };
 const matchesTask=(id:string)=>id.startsWith(`delete_${target.id}_`)&&/^\d+$/.test(id.slice(`delete_${target.id}_`.length));
 const assertSummary=(value:ProcessDeletionSummary,expectedTaskId?:string)=>{
  if(!value||value.processId!==target.id||value.protocol!==target.protocol||!value.id||!matchesTask(value.id)
   ||(expectedTaskId&&value.id!==expectedTaskId))throw new Error('A resposta não corresponde a este TCC.');
 };
 const fromSummary=(cleanup:ProcessDeletionSummary,expectedTaskId?:string):DeletionDialogState=>{
  assertSummary(cleanup,expectedTaskId);
  if(!['PENDING','COMPLETED'].includes(cleanup.status))throw new Error('Situação da limpeza inválida.');
  return {phase:cleanup.status==='COMPLETED'?'completed':'pending',busy:false,taskId:cleanup.id,cleanup,
   message:cleanup.status==='COMPLETED'?'TCC excluído e limpeza concluída.':'A exclusão foi iniciada. A limpeza dos recursos vinculados ainda não foi confirmada.'};
 };
 const readState=async(taskId?:string,signal?:AbortSignal):Promise<DeletionDialogState>=>{
  const scope=generation;
  readController=new AbortController();
  const controller=readController;
  const abort=()=>controller.abort();
  signal?.addEventListener('abort',abort,{once:true});
  if(signal?.aborted)controller.abort();
  let result:ProcessDeletionStatusResult;
  try{result=await ports.read(target.id,taskId,controller.signal);}
  finally{signal?.removeEventListener('abort',abort);}
  if(!active||generation!==scope)throw new Error('Consulta encerrada.');
  if(result.processId!==target.id||(result.protocol&&result.protocol!==target.protocol)
   ||(taskId&&result.taskId&&result.taskId!==taskId))throw new Error('A consulta não corresponde a este TCC.');
  if(result.state==='PENDING'){
   if(!result.cleanup||result.taskId!==result.cleanup.id)throw new Error('A limpeza pendente não foi identificada.');
   const confirmed=fromSummary(result.cleanup,taskId);deletionMayBeRunning=false;return confirmed;
  }
  if(result.state==='COMPLETED'&&result.taskId&&matchesTask(result.taskId)){
   deletionMayBeRunning=false;
   return {phase:'completed',busy:false,taskId:result.taskId,message:'TCC excluído e limpeza concluída.'};
  }
  if(result.state==='NOT_STARTED'&&!taskId&&!deletionMayBeRunning)return {phase:'confirm',busy:false,message:'O Portal confirmou que a exclusão não foi iniciada. Confira a mensagem e tente novamente quando estiver pronto.'};
  return {phase:'uncertain',busy:false,taskId,message:'O resultado ainda não foi confirmado. Consulte o andamento aqui antes de repetir a operação.'};
 };
 return {
  snapshot:()=>({...state}),
  activate:()=>{active=true;ports.change({...state});},
  dispose:()=>{active=false;generation++;readController?.abort();if(state.busy)state={...state,phase:'uncertain',busy:false,message:'Consulte o andamento antes de continuar.'};},
  async run(action:'delete'|'check'|'retry',confirmation='',checkSignal?:AbortSignal){
   if(!active||state.busy||state.phase==='completed')return;
   if(action==='delete'&&(state.phase!=='confirm'||confirmation.trim().toUpperCase()!=='EXCLUIR'))return;
   if(action==='retry'&&(state.phase!=='pending'||!state.taskId))return;
   const scope=generation,prior={...state};
   update({...state,busy:true,message:action==='delete'?'Excluindo o TCC e conferindo os recursos vinculados…':action==='retry'?'Tentando concluir a limpeza deste TCC…':'Conferindo o andamento da exclusão…'},scope);
   let mutationRequested=false;
   try{
    let next:DeletionDialogState;
    if(action==='delete'){
     mutationRequested=true;deletionMayBeRunning=true;
     const result=await ports.remove(target.id);
     if(!active||generation!==scope)return;
     if(result.processId!==target.id||result.protocol!==target.protocol||result.cleanupTaskId!==result.cleanup?.id
      ||result.cleanupPending!==(result.cleanup?.status==='PENDING'))throw new Error('A exclusão precisa ser conferida no servidor.');
     next=fromSummary(result.cleanup,result.cleanupTaskId);deletionMayBeRunning=false;
    }else if(action==='retry'){
     next=await readState(prior.taskId);
     if(!active||generation!==scope)return;
     if(next.phase==='pending'&&next.taskId){
      if(Date.parse(next.cleanup?.processingUntil||'')>now()){
       next.message='A limpeza ainda está em processamento. Aguarde e consulte o andamento aqui.';
      }else{
       mutationRequested=true;
       next=fromSummary(await ports.retry(next.taskId),next.taskId);
      }
     }
    }else next=await readState(prior.taskId,checkSignal);
    update(next,scope);
   }catch(error){
    if(!active||generation!==scope)return;
    if(action==='delete'&&ports.rejectsBeforeDelete?.(error))deletionMayBeRunning=false;
    // A lost response is ambiguous: only read back; never repeat DELETE or POST.
    if(!mutationRequested){update({phase:'uncertain',busy:false,taskId:prior.taskId,message:'Não foi possível consultar o andamento. Tente verificar novamente nesta janela.'},scope);return;}
    try{
     const next=await readState(prior.taskId);
     if(next.phase==='confirm')next.message=error instanceof Error?error.message:'A exclusão não foi iniciada.';
     update(next,scope);
    }catch{
     update({phase:'uncertain',busy:false,taskId:prior.taskId,message:'Não foi possível confirmar o resultado. Use Verificar andamento nesta janela antes de tentar outra ação.'},scope);
    }
   }
  },
 };
}

/** Observe a deletion acknowledgement only; never create or retry a deletion. */
export function createDeletionStatusWatcher(ports:{
 snapshot:()=>DeletionDialogState;
 check:(signal:AbortSignal)=>Promise<void>;
 now?:()=>number;
 schedule?:(callback:()=>void,delay:number)=>ReturnType<typeof setTimeout>;
 cancel?:(timer:ReturnType<typeof setTimeout>)=>void;
}){
 const now=()=>ports.now?.()??Date.now();
 const schedule=ports.schedule??((callback,delay)=>setTimeout(callback,delay));
 const cancel=ports.cancel??clearTimeout;
 let active=false,startedAt:number|undefined,attempts=0,inFlight=false;
 let timer:ReturnType<typeof setTimeout>|undefined,deadlineTimer:ReturnType<typeof setTimeout>|undefined;
 let controller:AbortController|undefined;
 const clear=()=>{if(timer!==undefined)cancel(timer);if(deadlineTimer!==undefined)cancel(deadlineTimer);timer=undefined;deadlineTimer=undefined;};
 const stop=()=>{active=false;clear();controller?.abort();};
 const eligible=(state:DeletionDialogState)=>state.phase==='uncertain'||state.phase==='pending'&&(Date.parse(state.cleanup?.processingUntil||'')>now()
  ||Boolean(state.cleanup)&&(state.cleanup?.attemptCount??0)===0&&!state.cleanup?.errors?.length);
 const update=()=>{
  if(!active)return;
  const state=ports.snapshot();
  if(state.phase==='completed'){stop();return;}
  if(startedAt!==undefined&&(now()-startedAt>=30_000||attempts>=6&&!inFlight)){stop();return;}
  if(!eligible(state)){if(timer!==undefined)cancel(timer);timer=undefined;return;}
  if(startedAt===undefined){startedAt=now();deadlineTimer=schedule(stop,30_000);}
  if(state.busy||inFlight||timer!==undefined)return;
  const remaining=30_000-(now()-startedAt);
  if(remaining<=3_000)return;
  timer=schedule(()=>{
   timer=undefined;
   if(!active||ports.snapshot().busy||!eligible(ports.snapshot())){update();return;}
   inFlight=true;attempts++;controller=new AbortController();
   void ports.check(controller.signal).catch(()=>undefined).finally(()=>{inFlight=false;controller=undefined;update();});
  },3_000);
 };
 return {start:()=>{active=true;update();},update,stop};
}
