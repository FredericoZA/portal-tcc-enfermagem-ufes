import {createHash} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {localDocumentModelsEnabled} from './localDocumentModels';
import {getGoogleWorkspaceAccessToken} from './integrations/googleWorkspace';
import {ensurePortalProcessDriveFolder,uploadProcessSourcePdf,downloadDrivePdf} from './integrations/googleDriveArchive';

/** Explicit localhost review only. Production always retains its real provider path. */
export function localReviewFilesEnabled(env:NodeJS.ProcessEnv=process.env){
 return localDocumentModelsEnabled(env)&&env.NODE_ENV==='development'&&env.PORTAL_LOCAL_REVIEW_DATA==='true'&&env.PORTAL_ALLOW_INSECURE_DEMO_AUTH==='true';
}
const directory=()=>path.join(process.env.PORTAL_DATA_DIR||path.join(process.cwd(),'.portal-data'),'arquivos-demonstrativos');
export function storeReviewPdf(input:{processId:string;artifactType:string;fileName:string;pdf:Buffer;sha256:string}){
 if(!localReviewFilesEnabled())throw new Error('Arquivos demonstrativos desabilitados.');
 if(!input.pdf.subarray(0,5).equals(Buffer.from('%PDF-'))||input.pdf.length>24*1024*1024)throw new Error('Envie um PDF válido de até 24 MB.');
 const hash=createHash('sha256').update(input.pdf).digest('hex');if(hash!==input.sha256)throw new Error('Integridade do PDF inválida.');
 const key=createHash('sha256').update(JSON.stringify([input.processId,input.artifactType,hash])).digest('hex');
 const id=`local_review_${key}`;mkdirSync(directory(),{recursive:true,mode:0o700});
 writeFileSync(path.join(directory(),`${key}.pdf`),input.pdf,{mode:0o600});
 writeFileSync(path.join(directory(),`${key}.json`),JSON.stringify({processId:input.processId,artifactType:input.artifactType,fileName:path.basename(input.fileName),sha256:hash}),{mode:0o600});
 return {id,name:path.basename(input.fileName),webViewLink:''};
}
export function readReviewPdf(fileId:string,expected:{processId?:string;artifactType?:string}={}){
 if(!localReviewFilesEnabled())throw new Error('Arquivos demonstrativos desabilitados.');
 const key=/^local_review_([a-f0-9]{64})$/.exec(fileId)?.[1];if(!key)throw new Error('Referência demonstrativa inválida.');
 const metadata=JSON.parse(readFileSync(path.join(directory(),`${key}.json`),'utf8'));
 if(expected.processId&&metadata.processId!==expected.processId||expected.artifactType&&metadata.artifactType!==expected.artifactType)throw new Error('Arquivo não pertence a este processo ou tipo.');
 const pdf=readFileSync(path.join(directory(),`${key}.pdf`));if(createHash('sha256').update(pdf).digest('hex')!==metadata.sha256)throw new Error('Integridade do arquivo inválida.');
 return {pdf,fileName:String(metadata.fileName)};
}
export const sourceFilesAccessToken=async()=>localReviewFilesEnabled()?'LOCAL_REVIEW_FILES':getGoogleWorkspaceAccessToken();
export async function sourceFilesFolder(input:Parameters<typeof ensurePortalProcessDriveFolder>[0]){
 return localReviewFilesEnabled()&&input.accessToken==='LOCAL_REVIEW_FILES'?{id:`local_review_folder_${createHash('sha256').update(input.processId).digest('hex')}`,webViewLink:''}:ensurePortalProcessDriveFolder(input);
}
export async function uploadSourceFile(input:Parameters<typeof uploadProcessSourcePdf>[0]){
 return localReviewFilesEnabled()&&input.accessToken==='LOCAL_REVIEW_FILES'?storeReviewPdf(input):uploadProcessSourcePdf(input);
}
export async function downloadSourceFile(accessToken:string,fileId:string,expected?:Parameters<typeof downloadDrivePdf>[2]){
 return localReviewFilesEnabled()&&fileId.startsWith('local_review_')?readReviewPdf(fileId,expected):downloadDrivePdf(accessToken,fileId,expected);
}
