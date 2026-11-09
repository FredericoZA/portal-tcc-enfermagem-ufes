import type {ProcessData,SignatureJob} from '../../src/types';
import {ataArchived} from './gates';
import {assertSignatureEligibility,hasCompetingSignatureArchive,signatureJobMatchesCurrentRevision} from './signaturePolicy';

export const ASTEN_STATUS_CHECK_INTERVAL_MS=2*60_000;
// Preserve the historical export for consumers that only check atas.
export const ATA_STATUS_CHECK_INTERVAL_MS=ASTEN_STATUS_CHECK_INTERVAL_MS;

/** Only already dispatched, current documents can use the bounded status fallback. */
export function astenStatusCheckDue(process:ProcessData,job:SignatureJob,jobs:SignatureJob[],now=Date.now()):boolean{
  if(!['ATA','TERMO','DECLARACAO'].includes(job.documentType)||job.processId!==process.id||job.provider!=='ASTEN'||!job.providerEnvelopeId
    ||job.removedFromLogsAt||job.providerDispatchState==='SENDING'
    ||!['SENT','PARTIALLY_SIGNED','SIGNED','DRIVE_SYNC_PENDING'].includes(job.status)
    ||!signatureJobMatchesCurrentRevision(process,job)||hasCompetingSignatureArchive(process,job,jobs))return false;
  if(job.documentType!=='ATA'&&(!process.acervo?.submittedAt||!ataArchived(process,jobs)))return false;
  // Reading a provider state never releases a missing academic prerequisite.
  try{assertSignatureEligibility(process,job.documentType as 'ATA'|'TERMO'|'DECLARACAO',jobs);}catch{return false;}
  const recent=Math.max(Date.parse(job.updatedAt)||0,Date.parse(job.providerStatusCheckedAt||'')||0);
  return now-recent>=ASTEN_STATUS_CHECK_INTERVAL_MS;
}

export function ataStatusCheckDue(process:ProcessData,job:SignatureJob,jobs:SignatureJob[],now=Date.now()):boolean{
  return job.documentType==='ATA'&&astenStatusCheckDue(process,job,jobs,now);
}
