export type StagedUploadPurpose =
  | 'DOCUMENT_MODEL'
  | 'PROCESS_FULL_WORK'
  | 'PROCESS_EXPANDED_ABSTRACT'
  | 'GOV_BR_SIGNED_PDF'
  | 'VERIFICATION_PDF';

export interface StagedUploadDescriptor {
  purpose: StagedUploadPurpose;
  processId?: string;
  verificationCode?: string;
  fileName: string;
  size: number;
  mimeType: string;
  sha256: string;
}

export interface StagedUploadTicket { uploadId:string; uploadUrl:string; expiresAt:string; maxSizeBytes:number; provider:'drive'; }
export const LEGACY_DEVELOPMENT_UPLOAD_LIMIT=2*1024*1024;
export async function sha256File(file:Blob):Promise<string>{if(!globalThis.crypto?.subtle)throw new Error('Este navegador não oferece a verificação criptográfica exigida para o envio.');const digest=await globalThis.crypto.subtle.digest('SHA-256',await file.arrayBuffer());return Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');}
export function validateUploadFile(file:File,allowedMimeTypes:readonly string[],maxSizeBytes:number):void{const mime=file.type.toLowerCase().trim();if(!allowedMimeTypes.includes(mime))throw new Error('O tipo do arquivo não é permitido para esta etapa.');if(!Number.isSafeInteger(file.size)||file.size<=0||file.size>maxSizeBytes)throw new Error(`O arquivo deve ter entre 1 byte e ${Math.floor(maxSizeBytes/1024/1024)} MB.`);}
export async function uploadBinaryToSignedUrl(file: File, ticket: StagedUploadTicket, signal?: AbortSignal): Promise<void> {
  if (!ticket.uploadId || !ticket.uploadUrl || ticket.provider !== 'drive') {
    throw new Error('O servidor não forneceu uma autorização de upload para o Drive. Atualize a página.');
  }
  if (Date.parse(ticket.expiresAt) <= Date.now()) throw new Error('A autorização de upload expirou. Selecione o arquivo novamente.');
  if (file.size > ticket.maxSizeBytes) throw new Error('O arquivo ultrapassa o limite autorizado pelo servidor.');
  const target = new URL(ticket.uploadUrl);
  if (target.origin !== 'https://www.googleapis.com' || !/^\/upload\/drive\/v3\/files(?:\/[a-zA-Z0-9_-]+)?$/.test(target.pathname)
    || target.username || target.password || !target.searchParams.get('upload_id')) {
    throw new Error('Destino de upload do Drive inválido.');
  }
  const response = await fetch(target.href, {
    method: 'PUT', body: file, signal, credentials: 'omit', cache: 'no-store',
    referrerPolicy: 'no-referrer', redirect: 'error',
    headers: {'Content-Type': file.type, 'Content-Range': `bytes 0-${file.size - 1}/${file.size}`},
  });
  if (!response.ok) throw new Error(`O Drive não confirmou o arquivo (HTTP ${response.status}).`);
}
export function mayUseLegacyDevelopmentUpload(status:number,fileSize:number,isDevelopment:boolean):boolean{return isDevelopment&&fileSize<=LEGACY_DEVELOPMENT_UPLOAD_LIMIT&&(status===404||status===501||status===503);}
export async function fileToLegacyBase64(file:File,includeDataUrl=false):Promise<string>{if(file.size>LEGACY_DEVELOPMENT_UPLOAD_LIMIT)throw new Error('O fallback local aceita somente arquivos de até 2 MB.');return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>{const value=String(reader.result||'');resolve(includeDataUrl?value:value.split(',')[1]||'');};reader.onerror=()=>reject(new Error('Não foi possível ler o arquivo local.'));reader.readAsDataURL(file);});}
