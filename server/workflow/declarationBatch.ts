import type {GlobalSettings,ProcessData,SignatureJob} from '../../src/types';
import type {AstenDeclarationCheck} from '../../src/types/signatures';
import {assertSignatureEligibility,deriveSignatureSigners} from './signaturePolicy';

/** Read-only check. Dispatch repeats the canonical server gates immediately before sending. */
export function inspectAstenDeclaration(processId:string,process:ProcessData|undefined,jobs:SignatureJob[],settings:GlobalSettings):AstenDeclarationCheck{
  const result={processId,protocol:process?.protocolo||processId,ready:false,reason:''};
  try{
    if(!process)throw new Error('Processo não encontrado.');
    const current=jobs.filter(job=>job.processId===process.id&&job.documentType==='DECLARACAO'&&job.sourceDataRevision===process.dataRevision&&job.status!=='CANCELED');
    if(current.some(job=>job.provider==='GOV_BR'))throw new Error('Esta versão já está no fluxo Gov.br.');
    const asten=current.filter(job=>job.provider==='ASTEN').sort((a,b)=>b.documentVersion-a.documentVersion)[0];
    if(asten&&(asten.providerCreationState==='UNCERTAIN'||['SENDING','UNCERTAIN'].includes(asten.providerDispatchState||'')))throw new Error('O envio Asten exige reconciliação antes de outra tentativa.');
    if(asten&&!['WAITING_INTEGRATION','QUEUED','PROVIDER_ERROR'].includes(asten.status))throw new Error('Esta declaração já foi encaminhada à Asten ou concluída.');
    assertSignatureEligibility(process,'DECLARACAO',jobs);
    deriveSignatureSigners(process,'DECLARACAO',settings);
    if(!settings.documentModels?.DECLARACAO?.driveFileId)throw new Error('Cadastre o modelo da declaração antes do envio.');
    return {...result,ready:true,reason:'Pronta para envio pela Asten.'};
  }catch(error){return {...result,reason:error instanceof Error?error.message:'A declaração ainda não está pronta.'};}
}
