import {apiClient} from '../services/apiClient';
/** Fetch private document bytes with the active session; keep credentials on this origin. */
export async function downloadPortalDocument(url:string):Promise<void>{
 const target=new URL(url,window.location.origin);
 const parts=/^\/api\/processes\/([^/]+)\/documents\/([^/]+)\/download$/.exec(target.pathname);
 if(target.origin!==window.location.origin||!parts)throw new Error('Use o endereço privado do documento no Portal.');
 const {blob,fileName}=await apiClient.downloadProcessDocument(decodeURIComponent(parts[1]),decodeURIComponent(parts[2]));
 const objectUrl=URL.createObjectURL(blob),anchor=document.createElement('a');anchor.href=objectUrl;anchor.download=fileName;anchor.click();window.setTimeout(()=>URL.revokeObjectURL(objectUrl),1000);
}
