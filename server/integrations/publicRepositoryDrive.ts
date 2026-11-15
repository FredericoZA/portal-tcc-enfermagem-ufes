import {listDriveFilePermissions,isUnsafePrivateContainerPermission} from './googleDriveArchive';
const API='https://www.googleapis.com/drive/v3';
const esc=(s:string)=>s.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
const idOk=(s:string)=>/^[\w-]{10,150}$/.test(s);
const fields='id,name,mimeType,trashed,parents,appProperties,sha256Checksum,webViewLink,webContentLink';
async function request(token:string,path:string,init:RequestInit={}){
 const r=await fetch(API+path,{...init,headers:{Authorization:`Bearer ${token}`,...init.headers},signal:AbortSignal.timeout(20000)});
 if(!r.ok)throw Error('Não foi possível conferir a publicação no Google Drive.');return r;
}
function browserLink(value:unknown){try{const u=new URL(String(value));return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&['drive.google.com','docs.google.com','drive.usercontent.google.com'].includes(u.hostname)&&!['token','access_token','key'].some(k=>u.searchParams.has(k))?u.href:'';}catch{return '';}}
/** Publish the consent-bound original, never copy or transfer its bytes through the Portal. */
export async function publicRepositoryDriveLinks(input:{accessToken:string;sourceFileId:string;scope:string;sha256:string;artifactType?:'TRABALHO_COMPLETO'|'RESUMO_EXPANDIDO';assertAuthorized:()=>Promise<boolean>}){
 const {accessToken:token,sourceFileId,scope}=input,sha=input.sha256.toLowerCase();
 if(!idOk(sourceFileId)||!/^[a-f0-9]{64}$/.test(sha)||!scope||!await input.assertAuthorized())throw Error('Publicação não autorizada.');
 const endpoint=`/files/${encodeURIComponent(sourceFileId)}`;
 const permissions=()=>listDriveFilePermissions(token,sourceFileId);
 const revoke=async()=>{for(const p of await permissions())if(p.type==='anyone')await request(token,`${endpoint}/permissions/${encodeURIComponent(p.id)}?supportsAllDrives=true`,{method:'DELETE'});};
 const current=async()=>{if(!await input.assertAuthorized()){await revoke();throw Error('A autorização mudou.');}};
 const metadata=async()=>(await request(token,`${endpoint}?fields=${fields}&supportsAllDrives=true`)).json();
 const valid=(f:any)=>f?.id===sourceFileId&&!f.trashed&&f.mimeType==='application/pdf'&&String(f.sha256Checksum||'').toLowerCase()===sha;
 let source=await metadata();
 if(!valid(source)){await revoke();throw Error('O PDF difere do arquivo autorizado para publicação.');}
 if(input.artifactType&&(source.appProperties?.portal!=='portal-tcc'||source.appProperties?.portalProcessId!==scope||source.appProperties?.artifactType!==input.artifactType))throw Error('O PDF pertence a outro processo.');
 // A public file never makes its containing folder public.
 if(!Array.isArray(source.parents)||source.parents.length!==1||!idOk(source.parents[0]))throw Error('Pasta de origem não confirmada.');
 if((await listDriveFilePermissions(token,source.parents[0])).some(isUnsafePrivateContainerPermission))throw Error('A pasta de origem precisa permanecer privada.');
 try{
 let acl=await permissions();
 if(acl.filter(p=>p.role==='owner').length!==1)throw Error('Proprietário do original não confirmado.');
 // Only the owner may edit. Named collaborators are reduced to readers on this file only.
 for(const p of acl){
  if(p.role==='owner')continue;
  if(!p.id||!['user','anyone'].includes(p.type)){await revoke();throw Error('Compartilhamento amplo não permitido no original.');}
  if(p.role!=='reader'){
   await current();
   await request(token,`${endpoint}/permissions/${encodeURIComponent(p.id)}?supportsAllDrives=true`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({role:'reader',...(p.type==='anyone'?{allowFileDiscovery:false}:{})})});
  }
 }
 await current();
 acl=await permissions();
 if(!acl.some(p=>p.type==='anyone'&&p.role==='reader'))await request(token,`${endpoint}/permissions?supportsAllDrives=true`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'anyone',role:'reader',allowFileDiscovery:false})});
  source=await metadata();acl=await permissions();
  if(!valid(source)||!acl.some(p=>p.type==='anyone'&&p.role==='reader')||acl.some(p=>p.role!=='owner'&&(p.role!=='reader'||!['user','anyone'].includes(p.type))))throw Error('Leitura pública sem edição não confirmada.');
  await current();
  const view=browserLink(source.webViewLink),download=browserLink(source.webContentLink);
  if(!view||!download)throw Error('Links públicos do Drive não confirmados.');
  // Migrate only verified duplicates produced by the former implementation.
  const q=`trashed = false and appProperties has { key='portal' and value='portal-tcc' } and appProperties has { key='publicationSourceFileId' and value='${esc(sourceFileId)}' } and appProperties has { key='portalProcessId' and value='${esc(scope)}' }`;
  const found=await (await request(token,`/files?${new URLSearchParams({q,fields:`files(${fields}),nextPageToken`,pageSize:'100',supportsAllDrives:'true',includeItemsFromAllDrives:'true'})}`)).json();
  if(!Array.isArray(found.files)||found.nextPageToken)throw Error('Inventário de cópias antigas incompleto.');
  for(const copy of found.files){
   if(!idOk(String(copy.id))||copy.id===sourceFileId||copy.appProperties?.portal!=='portal-tcc'||copy.appProperties?.portalProcessId!==scope||copy.appProperties?.publicationSourceFileId!==sourceFileId||copy.appProperties?.artifactType!=='PUBLIC_REPOSITORY_COPY')throw Error('Vínculo da cópia antiga não confirmado.');
   for(const p of await listDriveFilePermissions(token,copy.id))if(p.type==='anyone')await request(token,`/files/${encodeURIComponent(copy.id)}/permissions/${encodeURIComponent(p.id)}?supportsAllDrives=true`,{method:'DELETE'});
   if(copy.mimeType==='application/pdf'&&String(copy.sha256Checksum||'').toLowerCase()===sha&&copy.appProperties?.sha256===sha)await request(token,`/files/${encodeURIComponent(copy.id)}?supportsAllDrives=true`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({trashed:true})});
  }
  await current();return {view,download};
 }catch(error){await revoke();throw error;}
}
