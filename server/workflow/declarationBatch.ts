import type {GlobalSettings,ProcessData,SignatureJob} from '../../src/types';
import type {AstenDeclarationCheck} from '../../src/types/signatures';
import {assertCurrentSignatureRecipients,assertSignatureEligibility,assertDocumentSignatureOpen,deriveSignatureSigners} from './signaturePolicy';

/** Read-only check. Dispatch repeats the canonical server gates immediately before sending. */
export function inspectAstenDeclaration(processId:string,process:ProcessData|undefined,jobs:SignatureJob[],settings:GlobalSettings):AstenDeclarationCheck{
  const result={processId,protocol:process?.protocolo||processId,ready:false,reason:'',recipientEmail:settings.commissionPresidentEmail||'',recipientName:settings.commissionPresidentName||'Presidência da Comissão'};
  try{
    if(!process)throw new Error('Processo não encontrado.');
    assertDocumentSignatureOpen(process,'DECLARACAO',jobs);
    const current=jobs.filter(job=>job.processId===process.id&&job.documentType==='DECLARACAO'&&job.sourceDataRevision===process.dataRevision&&job.status!=='CANCELED');
    const asten=current.filter(job=>job.provider==='ASTEN').sort((a,b)=>b.documentVersion-a.documentVersion)[0];
    if(asten&&(asten.providerCreationState==='UNCERTAIN'||['SENDING','UNCERTAIN'].includes(asten.providerDispatchState||'')))throw new Error('O envio Asten exige reconciliação antes de outra tentativa.');
    if(asten&&!['WAITING_INTEGRATION','QUEUED','PROVIDER_ERROR'].includes(asten.status)){
      const awaiting=['SENT','PARTIALLY_SIGNED'].includes(asten.status);
      return {...result,jobId:asten.id,status:asten.status,sentAt:asten.sentAt,
        recipientEmail:asten.signers[0]?.email||result.recipientEmail,recipientName:asten.signers[0]?.name||result.recipientName,
        reason:awaiting?'Solicitação já enviada. A presidência deve assinar pelo link recebido no e-mail da Asten.':asten.status==='DRIVE_SYNC_PENDING'||asten.status==='SIGNED'?'Assinatura concluída; aguardando arquivamento do PDF.':asten.status==='DECLINED'?'A solicitação foi recusada na Asten. Confira o andamento antes de iniciar outra versão.':asten.status==='EXPIRED'?'A solicitação expirou na Asten. Confira o andamento antes de iniciar outra versão.':'Esta declaração já possui uma solicitação. Atualize o andamento para conferir.'};
    }
    assertSignatureEligibility(process,'DECLARACAO',jobs);
    deriveSignatureSigners(process,'DECLARACAO',settings);
    if(asten)assertCurrentSignatureRecipients(process,'DECLARACAO',asten,settings);
    if(!settings.documentModels?.DECLARACAO?.driveFileId)throw new Error('Cadastre o modelo da declaração antes do envio.');
    return {...result,ready:true,reason:'Pronta para envio pela Asten.'};
  }catch(error){return {...result,reason:error instanceof Error?error.message:'A declaração ainda não está pronta.'};}
}
