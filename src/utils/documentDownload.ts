import {apiClient} from '../services/apiClient';
export async function downloadPortalDocument(url:string):Promise<void>{
 const target=new URL(url,window.location.origin);
 const parts=/^\/api\/(public\/)?processes\/([^/]+)\/documents\/([^/]+)\/download$/.exec(target.pathname);
 if(target.origin!==window.location.origin||!parts)throw new Error('Use o endereço do documento no Portal.');
 const id=decodeURIComponent(parts[2]),documentId=decodeURIComponent(parts[3]);
 const {blob,fileName}=await (parts[1] ? apiClient.downloadPublicProcessDocument(id,documentId) : apiClient.downloadProcessDocument(id,documentId));
 const objectUrl=URL.createObjectURL(blob),anchor=document.createElement('a');anchor.href=objectUrl;anchor.download=fileName;anchor.click();window.setTimeout(()=>URL.revokeObjectURL(objectUrl),1000);
}
