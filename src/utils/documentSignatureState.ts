import {validateSignatureRecipientRoles} from './signatureRecipientRoles';
import type {ProcessData} from '../types';
import type {SignatureJob} from '../types/signatures';

export function signatureDocumentRevision(process: {dataRevision:number; avaliacao?: Pick<ProcessData['avaliacao'],'documentRevision'>}, type: string): number {
 return type === 'ATA' ? process.avaliacao?.documentRevision ?? process.dataRevision : process.dataRevision;
}

/** A pending provider remains independent; a completed signature closes the document. */
export function documentSignatureCompleted(jobs:SignatureJob[],processId:string,documentType:string,dataRevision?:number):boolean{
 const matching=jobs.filter(job=>job.processId===processId&&job.documentType===documentType&&job.status!=='CANCELED');
 const revision=dataRevision??Math.max(-1,...matching.map(job=>job.sourceDataRevision));
 return matching.some(job=>job.sourceDataRevision===revision&&['SIGNED','DRIVE_SYNC_PENDING','ARCHIVED'].includes(job.status));
}

/** A second pending provider must not hide an already archived document of the same revision. */
export function documentSignatureArchived(jobs:SignatureJob[],processId:string,documentType:string):boolean{
 const matching=jobs.filter(job=>job.processId===processId&&job.documentType===documentType&&job.status!=='CANCELED').sort((a,b)=>b.documentVersion-a.documentVersion);
 const revision=matching[0]?.sourceDataRevision;
 return matching.some(job=>job.sourceDataRevision===revision&&job.status==='ARCHIVED'&&Boolean(job.driveSignedFileId));
}

type AtaProcess=Pick<ProcessData,'id'|'avaliacao'>&Partial<Pick<ProcessData,'aluno1'|'aluno2'|'orientador'|'coorientador'|'banca'>>;
function ataSignerSetComplete(process:AtaProcess,job:SignatureJob):boolean{
 const signers=job.signers||[];
 if(!signers.every(signer=>signer.status==='SIGNED'))return false;
 if(job.ataSignerPolicy===undefined)return signers.length===3&&signers.filter(s=>s.role==='ADVISOR').length===1&&signers.filter(s=>s.role==='EXAMINER').length===2&&new Set(signers.map(s=>s.email)).size===3;
 if(job.ataSignerPolicy!=='BOARD_AUTHORS_V1'||!process.aluno1||!process.orientador||!process.banca)return false;
 if(process.coorientador&&typeof process.avaliacao?.coadvisorPresent!=='boolean')return false;
 const examiners=process.banca.filter(person=>person.funcao==='EXAMINER_2'||person.funcao==='EXAMINER_3');
 if(examiners.filter(person=>person.funcao==='EXAMINER_2').length!==1||examiners.filter(person=>person.funcao==='EXAMINER_3').length!==1)return false;
 const expected=[{role:'ADVISOR',email:process.orientador.email},...examiners.map(person=>({role:'EXAMINER',email:person.email})),{role:'STUDENT',email:process.aluno1.email},...(process.aluno2?[{role:'STUDENT',email:process.aluno2.email}]:[]),...(process.coorientador&&process.avaliacao.coadvisorPresent===true?[{role:'CO_ADVISOR',email:process.coorientador.email}]:[])];
 const normalized=(email:string)=>email.trim().toLowerCase();
 const emails=expected.map(s=>normalized(s.email));
 if(expected.length<4||expected.length>6||emails.some(email=>!email)||new Set(emails).size!==emails.length)return false;
 const key=(people:Array<{role:string;email:string}>)=>people.map(person=>`${person.role}:${normalized(person.email)}`).sort().join('|');
 if(job.signerPolicySnapshot){
  const snapshot=job.signerPolicySnapshot;
  try{validateSignatureRecipientRoles({type:'ATA',signatureRecipientRoles:snapshot.roles});}catch{return false;}
  if(snapshot.version!==1||snapshot.documentType!=='ATA'||!/^[a-f0-9]{64}$/.test(snapshot.digest)||!Array.isArray(snapshot.signers)||snapshot.signers.length!==signers.length||signers.length>6||key(snapshot.signers)!==key(signers))return false;
  const frozenKey=new Set(snapshot.signers.map(s=>`${s.role}:${normalized(s.email)}`));
  return expected.every(s=>frozenKey.has(`${s.role}:${normalized(s.email)}`))&&new Set(signers.map(s=>normalized(s.email))).size===signers.length;
 }
 return expected.length===signers.length&&key(expected)===key(signers);
}

export function currentAtaArchived(process: AtaProcess, jobs: SignatureJob[]): boolean {
 const revision = process.avaliacao?.documentRevision;
 if(revision===undefined){
   const matching=jobs.filter(job=>job.processId===process.id&&job.documentType==='ATA'&&job.status!=='CANCELED').sort((a,b)=>b.documentVersion-a.documentVersion);
   const latestRevision=matching[0]?.sourceDataRevision;
   return matching.some(job=>job.sourceDataRevision===latestRevision&&job.status==='ARCHIVED'&&Boolean(job.driveSignedFileId)
     &&(job.ataSignerPolicy===undefined||process.avaliacao?.status==='CONCLUIDO'&&ataSignerSetComplete(process,job)));
 }
 return process.avaliacao.status === 'CONCLUIDO' && jobs.some(job =>
   job.processId === process.id && job.documentType === 'ATA' && job.sourceDataRevision === revision
   && job.status === 'ARCHIVED' && Boolean(job.driveSignedFileId)
   && ataSignerSetComplete(process,job)
 );
}

/** Repair the displayed legacy stage without treating PDF preparation as signing. */
export function processWithPendingAtaStage(process:ProcessData,jobs:SignatureJob[]):ProcessData{
 if(process.etapaAtual==='REPOSITORIO'&&process.avaliacao?.status==='CONCLUIDO'&&!process.acervo?.submittedAt&&!currentAtaArchived(process,jobs))return {...process,etapaAtual:'ASSINATURA',status:'AGUARDANDO_ASSINATURA'};
 return process;
}
