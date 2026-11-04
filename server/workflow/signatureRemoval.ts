import type {SignatureJob} from '../../src/types';

/** Removes an operational record without invalidating an already archived PDF. */
export async function removeSignatureRecord(job:SignatureJob,options:{
 actorEmail:string;now:string;cancelAndVerify:(envelopeId:string)=>Promise<boolean>;
}):Promise<SignatureJob>{
 if(job.removedFromLogsAt)return job;
 if(['SENDING','SIGNED','DRIVE_SYNC_PENDING'].includes(job.status)||job.providerCreationState==='CREATING'||job.providerDispatchState==='SENDING'){
  throw new Error('Aguarde a conclusão do envio ou do arquivamento antes de excluir este registro.');
 }
 if(job.provider==='ASTEN'&&job.providerCreationState==='UNCERTAIN'&&!job.providerEnvelopeId){
  throw new Error('Confira o envelope na Asten antes de excluir: a criação anterior não foi confirmada.');
 }
 const terminal=['ARCHIVED','CANCELED','DECLINED','EXPIRED'].includes(job.status);
 if(job.provider==='ASTEN'&&job.providerEnvelopeId&&!terminal){
  if(!await options.cancelAndVerify(job.providerEnvelopeId))throw new Error('A Asten ainda não confirmou o cancelamento. O registro foi mantido.');
 }
 return {...job,status:job.status==='ARCHIVED'?'ARCHIVED':'CANCELED',removedFromLogsAt:options.now,removedFromLogsBy:options.actorEmail,updatedAt:options.now};
}
