const escape=(value:string)=>value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const decode=(value:string)=>value.replace(/&amp;|&#38;|&#x26;/gi,'&');

/** Hide process URLs in HTML while preserving their exact destination and unrelated links. */
export function presentProcessEmailLinks(html:string,input:{baseUrl:string;processId:string;protocol:string;color?:string}):string{
 const base=new URL(input.baseUrl);
 if(!['https:','http:'].includes(base.protocol))throw new Error('Endereço do Portal inválido.');
 const origin=base.origin;
 const isProcess=(value:string)=>{try{const url=new URL(decode(value));return ['https:','http:'].includes(url.protocol)&&url.origin===origin&&url.searchParams.get('tcc')===input.processId;}catch{return false;}};
 const color=/^#[a-f0-9]{6}$/i.test(input.color||'')?input.color:'#005b3b';
 const label=escape(input.protocol||'Acessar TCC');
 const button=(url:string)=>`<a data-portal-tcc-link="true" href="${escape(decode(url))}" style="display:inline-block;padding:10px 18px;border-radius:8px;background:${color};color:#ffffff;font-family:Arial,sans-serif;font-weight:bold;text-decoration:none">${label}</a>`;
 // Change visible URL labels and existing process CTA labels, never their destinations.
 const anchors=html.replace(/(<a\b(?:"[^"]*"|'[^']*'|[^'">])*>)([\s\S]*?)(<\/a\s*>)/gi,(whole,open,body,close)=>{
  const href=open.match(/\bhref\s*=\s*(?:"([^"]*)"|'([^']*)')/i);const url=href?.[1]||href?.[2]||'';
  if(!isProcess(url))return whole;
  const visible=decode(body.replace(/<[^>]*>/g,'').trim());
  if(/^https?:\/\//i.test(visible))return button(url);
  return /background\s*:/i.test(open)?`${open}${label}${close}`:whole;
 });
 let anchorDepth=0,hiddenDepth=0;
 // Tokenize tags with quoted attributes so URLs in href/src are never replaced as text.
 return (anchors.match(/<!--[\s\S]*?-->|<(?:"[^"]*"|'[^']*'|[^'">])*>|[^<]+|</g)||[]).map(token=>{
  if(token.startsWith('<')){
   if(/^<a(?:\s|>)/i.test(token))anchorDepth++;
   if(/^<\/a\s*>/i.test(token))anchorDepth=Math.max(0,anchorDepth-1);
   if(/^<(script|style)(?:\s|>)/i.test(token))hiddenDepth++;
   if(/^<\/(script|style)\s*>/i.test(token))hiddenDepth=Math.max(0,hiddenDepth-1);
   return token;
  }
  if(anchorDepth||hiddenDepth)return token;
  let text=token;
  const prefix=`Acesso ao TCC ${escape(input.protocol)}: `;
  text=text.replace(prefix,'');
  return text.replace(/https?:\/\/[^\s<)]+/g,match=>{
   const url=match.replace(/[.,;:!?]+$/,'');
   return isProcess(url)?button(url)+match.slice(url.length):match;
  });
 }).join('');
}
