import type {ProcessData,ProcessDocument} from '../types';
import type {SignatureJob,DocumentSignatureProgress} from '../types/signatures';
import {signatureDocumentRevision} from './documentSignatureState';

/** Counts and delivery state only: safe for the public document card, with no personal links. */
export function documentSignatureProgress(process:ProcessData,doc:ProcessDocument,jobs:SignatureJob[]):DocumentSignatureProgress|undefined{
 if(!doc.requiresSignature||doc.type==='CONVITE')return undefined;
 const revision=signatureDocumentRevision(process,doc.type);
 const job=jobs.filter(item=>item.processId===process.id&&item.documentType===doc.type&&item.documentVersion===doc.currentVersion&&item.sourceDataRevision===revision&&!item.removedFromLogsAt&&item.status!=='CANCELED')
  .sort((a,b)=>Number(b.status==='ARCHIVED')-Number(a.status==='ARCHIVED')||Date.parse(b.updatedAt)-Date.parse(a.updatedAt))[0];
 const generated=Boolean(job?.driveUnsignedFileId||job?.driveSignedFileId||job&&['SENT','PARTIALLY_SIGNED','SIGNED','DRIVE_SYNC_PENDING','ARCHIVED'].includes(job.status)||doc.status==='ASSINADO'||doc.type==='ATA'&&process.avaliacao?.reviewedAta);
 if(!generated)return undefined;
 const total=job?.signers.length|| (doc.type==='ATA'?3+1+Number(Boolean(process.aluno2))+Number(Boolean(process.coorientador&&process.avaliacao?.coadvisorPresent)):doc.type==='TERMO'?2+Number(Boolean(process.aluno2)):1);
 return {generated:true,total,signed:job?.signers.filter(s=>s.status==='SIGNED').length||0,status:job?.status,provider:job?.provider||doc.signatureProvider||'ASTEN',emailSent:Boolean(job?.provider==='ASTEN'&&(job.sentAt||job.providerDispatchState==='SENT'||job.status==='PARTIALLY_SIGNED'))};
}
export function signatureProgressDescription(progress:DocumentSignatureProgress):string{
 const count=`Assinaturas: ${progress.signed} de ${progress.total}.`;
 if(progress.status==='SIGNED'||progress.status==='DRIVE_SYNC_PENDING'||progress.status==='ARCHIVED')return `${count} Assinaturas concluídas; aguardando a disponibilização do documento.`;
 if(progress.provider==='GOV_BR')return `${count} Aguardando o PDF com todas as assinaturas pelo Gov.br.`;
 if(progress.emailSent)return `${count} Solicitação de assinatura enviada por e-mail (ASTEN). Aguardando as assinaturas restantes.`;
 if(['PROVIDER_ERROR','WAITING_INTEGRATION','DECLINED','EXPIRED'].includes(progress.status||''))return `${count} O envio ou a assinatura pela ASTEN está pendente de regularização.`;
 return `${count} Preparando o envio da solicitação por e-mail (ASTEN).`;
}
