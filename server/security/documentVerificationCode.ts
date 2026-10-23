import {createHmac} from 'node:crypto';
export function documentVerificationCode(input:{secret:string;installationId:string;processId:string;documentType:string;dataRevision:number;documentVersion:number}):string{
  if(input.secret.trim().length<32)throw new Error('Configure PORTAL_VERIFICATION_SECRET com pelo menos 32 caracteres.');
  if(!Number.isSafeInteger(input.documentVersion)||input.documentVersion<1)throw new Error('Versão documental inválida para validação.');
  const legacySeed=`${input.installationId}|${input.processId}|${input.documentType}|${input.dataRevision}`;
  const seed=input.documentVersion===1?legacySeed:`${legacySeed}|documentVersion:${input.documentVersion}`;
  return createHmac('sha256',input.secret.trim()).update(seed).digest('base64url').slice(0,32);
}
