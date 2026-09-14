export interface OrderedSigner {
  status: string;
  signingOrder: number;
}

export function nextPendingSignatureSigner<T extends OrderedSigner>(signers:T[]):T|undefined {
  return signers
    .filter((signer)=>signer.status!=='SIGNED')
    .slice()
    .sort((a,b)=>a.signingOrder-b.signingOrder)[0];
}
