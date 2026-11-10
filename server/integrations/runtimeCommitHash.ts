import {createHash} from 'node:crypto';

// PostgreSQL jsonb::text orders object keys by UTF-8 byte length, then bytes,
// adds separator spaces and renders numeric exponents as decimal notation.
// The input has already passed through JSON.stringify/parse before persistence.
export function runtimeCommitJsonbText(value:unknown):string {
  if(value===null)return 'null';
  if(typeof value==='string'||typeof value==='boolean')return JSON.stringify(value);
  if(typeof value==='number'){
    if(!Number.isFinite(value))throw new Error('Invalid JSON number.');
    const text=JSON.stringify(value);
    if(!/[eE]/.test(text))return text;
    const [coefficient,exponent]=text.toLowerCase().split('e');
    const sign=coefficient.startsWith('-')?'-':'';
    const unsigned=sign?coefficient.slice(1):coefficient;
    const [integer,fraction='']=unsigned.split('.');
    const digits=integer+fraction,point=integer.length+Number(exponent);
    return sign+(point<=0?'0.'+'0'.repeat(-point)+digits:point>=digits.length?digits+'0'.repeat(point-digits.length):digits.slice(0,point)+'.'+digits.slice(point));
  }
  if(Array.isArray(value))return '['+value.map(runtimeCommitJsonbText).join(', ')+']';
  if(typeof value==='object'){
    const entries=Object.entries(value).map(([key,item])=>({key,item,bytes:Buffer.from(key)}));
    entries.sort((a,b)=>a.bytes.length-b.bytes.length||Buffer.compare(a.bytes,b.bytes));
    return '{'+entries.map(({key,item})=>JSON.stringify(key)+': '+runtimeCommitJsonbText(item)).join(', ')+'}';
  }
  throw new Error('Invalid JSON value.');
}

export function runtimeCommitPayloadHash(payload:object):string {
  return createHash('sha256').update(runtimeCommitJsonbText(payload)).digest('hex');
}
