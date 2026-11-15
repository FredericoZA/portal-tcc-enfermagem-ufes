import {listDriveFilePermissions,isUnsafePrivateContainerPermission} from './googleDriveArchive';
const API='https://www.googleapis.com/drive/v3';
const esc=(s:string)=>s.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
const idOk=(s:string)=>/^[\w-]{10,150}$/.test(s);
const fields='id,name,mimeType,trashed,parents,appProperties,sha256Checksum,webViewLink,webContentLink';
async function request(token:string,path:string,init:RequestInit={}){
 const r=await fetch(API+path,{...init,headers:{Authorization:`Bearer ${token}`,...init.headers},signal:AbortSignal.timeout(20000)});
 if(!r.ok)throw Error('Não foi possível conferir a cópia pública no Google Drive.');return r;
}
function browserLink(value:unknown){try{const u=new URL(String(value));return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&['drive.google.com','docs.google.com','drive.usercontent.google.com'].includes(u.hostname)&&!['token','access_token','key'].some(k=>u.searchParams.has(k))?u.href:'';}catch{return '';}}
/** No source bytes cross the Portal. Google checksums bind the public copy to consent.
 * Existing private/revoked copies are never republished by a GET. */
export async function publicRepositoryDriveLinks(input:{accessToken:string;sourceFileId:string;scope:string;sha256:string;artifactType?:'TRABALHO_COMPLETO'|'RESUMO_EXPANDIDO';assertAuthorized:()=>Promise<boolean>}){
 const {accessToken:token,sourceFileId,scope}=input,sha=input.sha256.toLowerCase();
 if(!idOk(sourceFileId)||!/^[a-f0-9]{64}$/.test(sha)||!scope||!await input.assertAuthorized())throw Error('Publicação não autorizada.');
 let createdId='';
 const metadata=async(id:string)=>(await request(token,`/files/${encodeURIComponent(id)}?fields=${fields}&supportsAllDrives=true`)).json();
 const valid=(f:any)=>f&&idOk(f.id)&&!f.trashed&&f.mimeType==='application/pdf'&&String(f.sha256Checksum||'').toLowerCase()===sha;
 try{
  const q=`trashed = false and appProperties has { key='portal' and value='portal-tcc' } and appProperties has { key='publicationSourceFileId' and value='${esc(sourceFileId)}' } and appProperties has { key='portalProcessId' and value='${esc(scope)}' }`;
  const found=await (await request(token,`/files?${new URLSearchParams({q,fields:'files(id),nextPageToken',pageSize:'100',supportsAllDrives:'true',includeItemsFromAllDrives:'true'})}`)).json();
  if(!Array.isArray(found.files)||found.nextPageToken)throw Error('Inventário público incompleto.');
  let copy:any;
  for(const item of found.files){
   const f=await metadata(String(item.id));
   if(f.appProperties?.portal!=='portal-tcc'||f.appProperties?.portalProcessId!==scope||f.appProperties?.publicationSourceFileId!==sourceFileId||f.appProperties?.artifactType!=='PUBLIC_REPOSITORY_COPY')throw Error('Cópia pública de outro vínculo.');
   if(!valid(f)||f.appProperties?.sha256!==sha){
    // A known public copy that changed must lose its public permission too;
    // refusing the new Portal link alone would leave previously issued Drive links usable.
    for(const permission of await listDriveFilePermissions(token,f.id))if(permission.type==='anyone')await request(token,`/files/${encodeURIComponent(f.id)}/permissions/${encodeURIComponent(permission.id)}?supportsAllDrives=true`,{method:'DELETE'});
    throw Error('A cópia pública mudou. A publicação precisa ser revisada.');
   }
   const acl=await listDriveFilePermissions(token,f.id);
   if(acl.some(p=>isUnsafePrivateContainerPermission(p)&&!(p.type==='anyone'&&p.role==='reader')))throw Error('Compartilhamento público inválido.');
   // Never turn a revoked/private existing copy public again from a visitor request.
   if(!acl.some(p=>p.type==='anyone'&&p.role==='reader'))throw Error('A cópia pública foi retirada ou ainda não foi confirmada.');
   copy??=f;
  }
  if(!copy){
   const source=await metadata(sourceFileId);
   if(!valid(source)||source.id!==sourceFileId)throw Error('O PDF difere do arquivo autorizado para publicação.');
   if(input.artifactType&&(source.appProperties?.portal!=='portal-tcc'||source.appProperties?.portalProcessId!==scope||source.appProperties?.artifactType!==input.artifactType))throw Error('O PDF pertence a outro processo.');
   const sourceAcl=await listDriveFilePermissions(token,sourceFileId);
   if(sourceAcl.some(isUnsafePrivateContainerPermission))throw Error('O original precisa permanecer privado.');
   const parents=source.parents;
   if(!Array.isArray(parents)||parents.length!==1||!idOk(parents[0]))throw Error('Pasta privada do original não confirmada.');
   if((await listDriveFilePermissions(token,parents[0])).some(isUnsafePrivateContainerPermission))throw Error('A pasta de origem precisa permanecer privada.');
   if(!await input.assertAuthorized())throw Error('A autorização mudou.');
   const made=await (await request(token,`/files/${encodeURIComponent(sourceFileId)}/copy?fields=${fields}&supportsAllDrives=true`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:source.name,parents,appProperties:{portal:'portal-tcc',portalProcessId:scope,artifactType:'PUBLIC_REPOSITORY_COPY',publicationSourceFileId:sourceFileId,sha256:sha}})})).json();
   if(idOk(String(made.id)))createdId=made.id;
   if(!createdId||createdId===sourceFileId||!valid(made))throw Error('A cópia do PDF não foi confirmada.');
   if(!await input.assertAuthorized())throw Error('A autorização mudou.');
   await request(token,`/files/${encodeURIComponent(createdId)}/permissions?supportsAllDrives=true`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'anyone',role:'reader',allowFileDiscovery:false})});
   copy=await metadata(createdId);
   if(!valid(copy))throw Error('A cópia pública mudou.');
   const acl=await listDriveFilePermissions(token,createdId);
   if(!acl.some(p=>p.type==='anyone'&&p.role==='reader')||acl.some(p=>isUnsafePrivateContainerPermission(p)&&!(p.type==='anyone'&&p.role==='reader')))throw Error('Leitura pública não confirmada.');
  }
  if(!await input.assertAuthorized())throw Error('A autorização mudou.');
  const view=browserLink(copy.webViewLink),download=browserLink(copy.webContentLink);
  if(!view||!download)throw Error('Links públicos do Drive não confirmados.');
  return {view,download};
 }catch(error){
  // A failed or stale first publication never leaves a usable orphan link.
  if(createdId)await request(token,`/files/${encodeURIComponent(createdId)}?supportsAllDrives=true`,{method:'DELETE'}).catch(()=>undefined);
  throw error;
 }
}
