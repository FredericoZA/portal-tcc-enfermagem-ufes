/** Keep only each name part's initial uppercase, preserving alphabets and punctuation. */
export function normalizePersonName(raw:string):string {
 const particles=new Set(['de','do','da','dos','das','e']);
 return raw.normalize('NFC').trim().replace(/\s+/gu,' ').split(' ').map((token,index)=>{
  if(index>0&&particles.has(token.toLowerCase()))return token.toLowerCase();
  return token.split(/(-)/u).map(part=>{
   if(!/\p{L}/u.test(part))return part;
   const lower=part.toLowerCase();
   return lower.replace(/(^|['’ʼ])([\p{L}\p{M}])/gu,(_match,separator,letter)=>separator+letter.toUpperCase());
  }).join('');
 }).join(' ');
}
