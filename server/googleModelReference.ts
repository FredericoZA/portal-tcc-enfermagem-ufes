/** Model scanners accept Drive/Docs references, never arbitrary network addresses. */
export function googleModelReference(value:unknown):string|null{
 if(typeof value!=='string'||value.length>2048)return null;
 const raw=value.trim();
 if(/^[A-Za-z0-9_-]{10,200}$/.test(raw))return raw;
 try{
  const url=new URL(raw);
  if(url.protocol!=='https:'||!['drive.google.com','docs.google.com'].includes(url.hostname)||url.username||url.password||url.port)return null;
  const id=url.pathname.match(/\/d\/([A-Za-z0-9_-]+)(?:\/|$)/)?.[1]||url.searchParams.get('id');
  return id&&/^[A-Za-z0-9_-]{10,200}$/.test(id)?id:null;
 }catch{return null;}
}
