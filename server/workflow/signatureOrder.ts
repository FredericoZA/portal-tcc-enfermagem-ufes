export interface OrderedSigner {
  status: string;
  signingOrder: number;
}
interface ExistingAstenJob {
  processId:string;
  documentType:string;
  sourceDataRevision:number;
  provider:string;
  status:string;
  documentVersion:number;
}
export function reusableAstenSignatureJob<T extends ExistingAstenJob>(jobs:T[],processId:string,documentType:string,revision:number):T|undefined {
  return jobs.filter(job=>job.processId===processId&&job.documentType===documentType&&job.sourceDataRevision===revision&&job.provider==='ASTEN'&&job.status!=='CANCELED').sort((a,b)=>b.documentVersion-a.documentVersion)[0];
}

export function nextPendingSignatureSigner<T extends OrderedSigner>(signers:T[]):T|undefined {
  return signers
    .filter((signer)=>signer.status!=='SIGNED')
    .slice()
    .sort((a,b)=>a.signingOrder-b.signingOrder)[0];
}
