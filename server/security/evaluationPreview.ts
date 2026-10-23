import { createHmac, timingSafeEqual } from 'node:crypto';
export function evaluationPreviewToken(secret:string,binding:unknown,expiresAt:number):string {
  const payload=Buffer.from(JSON.stringify({binding,expiresAt})).toString('base64url');
  return `${payload}.${createHmac('sha256',secret).update(payload).digest('base64url')}`;
}
export function validEvaluationPreview(token:unknown,secret:string,binding:unknown,now=Date.now()):boolean {
  if(typeof token!=='string'||token.length>40000)return false;
  try {
    const [payload,signature,...extra]=token.split('.');if(extra.length||!payload||!signature)return false;
    const expected=createHmac('sha256',secret).update(payload).digest();const actual=Buffer.from(signature,'base64url');
    if(actual.length!==expected.length||!timingSafeEqual(actual,expected))return false;
    const parsed=JSON.parse(Buffer.from(payload,'base64url').toString());
    return parsed.expiresAt>now&&JSON.stringify(parsed.binding)===JSON.stringify(binding);
  }catch{return false;}
}
