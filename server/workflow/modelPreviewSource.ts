import type {DriveModelFingerprint} from '../integrations/googleWorkspace';

/** An administrative sample can inspect current bytes without publishing them. */
export function modelForRendering<T extends {driveFileId:string;contentSha256?:string;driveRevisionId?:string;driveModifiedTime?:string}>(published:T,processId:string,previewSource?:DriveModelFingerprint):T {
 if(!previewSource)return published;
 if(processId!=='model-preview')throw new Error('Uma versão de prévia só pode ser usada na amostra administrativa.');
 return {...published,...previewSource};
}
