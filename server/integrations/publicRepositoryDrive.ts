import {listDriveFilePermissions,isUnsafePrivateContainerPermission} from './googleDriveArchive';
const API='https://www.googleapis.com/drive/v3';
const esc=(s:string)=>s.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
const idOk=(s:string)=>/^[\w-]{10,150}$/.test(s);
const fields='id,name,mimeType,trashed,parents,appProperties,sha256Checksum,webViewLink,webContentLink';
async function request(token:string,path:string,init:RequestInit={}){
 const r=await fetch(API+path,{...init,headers:{Authorization:`Bearer ${token}`,...init.headers},signal:AbortSignal.timeout(20000)});
 if(!r.ok){const data=await r.json().catch(()=>({}));throw Object.assign(Error('Não foi possível conferir a publicação no Google Drive.'),{driveStatus:r.status,driveReason:String(data?.error?.errors?.[0]?.reason||'').replace(/[^a-zA-Z0-9_]/g,'').slice(0,80)});}return r;
}
function browserLink(value:unknown){try{const u=new URL(String(value));return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&['drive.google.com','docs.google.com','drive.usercontent.google.com'].includes(u.hostname)&&!['token','access_token','key'].some(k=>u.searchParams.has(k))?u.href:'';}catch{return '';}}
/** A folder owned by another account can impose editing rights on its children.
 * Keep the same original ID in a restricted child owned by the institutional account. */
async function isolateOriginal(input:{token:string;source:any;scope:string;ownerId:string;current:()=>Promise<void>}){
 const {token,source,scope,ownerId,current}=input,parent=source.parents[0];
 const folderFields='id,mimeType,trashed,parents,appProperties,inheritedPermissionsDisabled';
 const q=`trashed = false and '${esc(parent)}' in parents and mimeType = 'application/vnd.google-apps.folder' and appProperties has { key='portal' and value='portal-tcc' } and appProperties has { key='artifactType' and value='ORIGINALS_PRIVATE_FOLDER' } and appProperties has { key='portalProcessId' and value='${esc(scope)}' }`;
 await current();
 const listing=await (await request(token,`/files?${new URLSearchParams({q,fields:`files(${folderFields}),nextPageToken`,pageSize:'2'})}`)).json();
 if(!Array.isArray(listing.files)||listing.files.length>1||listing.nextPageToken)throw Error('Pasta privada do original não confirmada.');
 let folder=listing.files[0];
 if(!folder)folder=await (await request(token,`/files?fields=${folderFields}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'ORIGINAIS_DO_PORTAL',mimeType:'application/vnd.google-apps.folder',parents:[parent],appProperties:{portal:'portal-tcc',artifactType:'ORIGINALS_PRIVATE_FOLDER',portalProcessId:scope}})})).json();
 if(!idOk(String(folder.id))||folder.id===source.id||folder.id===parent||folder.mimeType!=='application/vnd.google-apps.folder'||folder.trashed||folder.appProperties?.portal!=='portal-tcc'||folder.appProperties?.artifactType!=='ORIGINALS_PRIVATE_FOLDER'||folder.appProperties?.portalProcessId!==scope||!folder.parents?.includes(parent))throw Error('Vínculo da pasta privada inválido.');
 const endpoint=`/files/${encodeURIComponent(folder.id)}`;
 if((await listDriveFilePermissions(token,folder.id)).find(p=>p.role==='owner')?.id!==ownerId)throw Error('A pasta precisa pertencer ao proprietário do original.');
 if(!folder.inheritedPermissionsDisabled){
  await current();
  await request(token,`${endpoint}?fields=${folderFields}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({inheritedPermissionsDisabled:true})});
 }
 folder=await (await request(token,`${endpoint}?fields=${folderFields}`)).json();
 if(!folder.inheritedPermissionsDisabled)throw Error('A restrição de herança não foi confirmada.');
 const acl=await listDriveFilePermissions(token,folder.id);
 if(acl.filter(p=>p.role==='owner').length!==1||acl.find(p=>p.role==='owner')?.id!==ownerId||acl.some(p=>p.role!=='owner'&&(p.view!=='metadata'||p.role!=='reader')))throw Error('A pasta privada possui acesso adicional ao conteúdo.');
 await current();
 await request(token,`/files/${encodeURIComponent(source.id)}?${new URLSearchParams({addParents:folder.id,removeParents:parent,fields})}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:'{}'});
 const moved=await (await request(token,`/files/${encodeURIComponent(source.id)}?fields=${fields}`)).json();
 if(moved.id!==source.id||moved.parents?.length!==1||moved.parents[0]!==folder.id||moved.sha256Checksum!==source.sha256Checksum)throw Error('A movimentação do original não foi confirmada.');
 return moved;
}
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
 const ownerId=acl.find(p=>p.role==='owner').id;let isolated=false;
 // Only the owner may edit. Named collaborators are reduced to readers on this file only.
 for(const p of acl){
  if(p.role==='owner')continue;
  if(!p.id||!['user','anyone'].includes(p.type)){await revoke();throw Error('Compartilhamento amplo não permitido no original.');}
  if(p.role!=='reader'){
   await current();
   try{await request(token,`${endpoint}/permissions/${encodeURIComponent(p.id)}?supportsAllDrives=true`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({role:'reader',...(p.type==='anyone'?{allowFileDiscovery:false}:{})})});}
   catch(error){
    if(isolated||(error as {driveStatus?:number}).driveStatus!==403)throw error;
    source=await isolateOriginal({token,source,scope,ownerId,current});isolated=true;
    for(const remaining of await permissions())if(remaining.role!=='owner'&&remaining.role!=='reader')await request(token,`${endpoint}/permissions/${encodeURIComponent(remaining.id)}?supportsAllDrives=true`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({role:'reader'})});
    break;
   }
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
