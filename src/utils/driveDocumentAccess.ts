export interface DriveDocumentAccess {
  links: {view:string;download:string}|null;
}

export function driveDocumentViewUrl(result:DriveDocumentAccess):string {
  if (!result.links) throw new Error('O arquivo original ainda não foi vinculado a este documento no Google Drive. Confira os dados do processo.');
  let url:URL;
  try { url=new URL(result.links.view); } catch { throw new Error('O endereço do arquivo no Google Drive não foi confirmado.'); }
  if(url.protocol!=='https:'||url.username||url.password||url.port||!['drive.google.com','docs.google.com','drive.usercontent.google.com'].includes(url.hostname)||['access_token','token','key'].some(key=>url.searchParams.has(key)))throw new Error('O endereço do arquivo no Google Drive não foi confirmado.');
  return url.href;
}

/** Open the window during the click; the server resolves the exact authorized original. */
export async function openDriveDocument(resolve:()=>Promise<DriveDocumentAccess>,isCurrent:()=>boolean=()=>true):Promise<void>{
  const tab=window.open('about:blank','_blank');
  if(!tab)throw new Error('Permita a abertura de uma nova aba para acessar o arquivo no Google Drive.');
  tab.opener=null;
  try {
    const result=await resolve();
    if(!isCurrent()){tab.close();return;}
    tab.location.replace(driveDocumentViewUrl(result));
  }catch(error){tab.close();throw error;}
}
