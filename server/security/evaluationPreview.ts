import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
const bindingHash=(binding:unknown)=>createHash('sha256').update(JSON.stringify(binding)).digest('hex');
export interface AtaPreviewSource { fileId:string; version:number; verificationCode:string }
export function evaluationPreviewToken(secret:string,binding:unknown,expiresAt:number,source?:AtaPreviewSource):string {
  const payload=Buffer.from(JSON.stringify({bindingSha256:bindingHash(binding),expiresAt,source})).toString('base64url');
  return `${payload}.${createHmac('sha256',secret).update(payload).digest('base64url')}`;
}
export function validEvaluationPreview(token:unknown,secret:string,binding:unknown,now=Date.now()):boolean {
  return Boolean(readEvaluationPreview(token,secret,binding,now));
}
export function readEvaluationPreview(token:unknown,secret:string,binding:unknown,now=Date.now()):{source?:AtaPreviewSource}|null {
  if(typeof token!=='string'||token.length>40000)return null;
  try {
    const [payload,signature,...extra]=token.split('.');if(extra.length||!payload||!signature)return null;
    const expected=createHmac('sha256',secret).update(payload).digest();const actual=Buffer.from(signature,'base64url');
    if(actual.length!==expected.length||!timingSafeEqual(actual,expected))return null;
    const parsed=JSON.parse(Buffer.from(payload,'base64url').toString());
    return parsed.expiresAt>now&&parsed.bindingSha256===bindingHash(binding)?{source:parsed.source}:null;
  }catch{return null;}
}
