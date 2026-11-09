import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import type {GlobalSettings,PublicBlankPdfArtifact} from '../../src/types';
import {readAttendanceReferencePdf} from '../integrations/googleWorkspace';
export const ATTENDANCE_MODEL='DECLARACAO_COMPARECIMENTO';
// Approved public blank distribution, derived from the exact private v1 DOCX.
export const attendanceBootstrap={driveFileId:'1B-tLcpdG0MN9Gf8KW4TDnA351lYgVVd1',sourceFileId:'1o2UxLhyy4yiq2uWE6lqiAd6YGnPqcPcZ',sourceContentSha256:'4bb8b01bc937254c7d9b58dee7287a759b40b2293cde222a355e3e7af1c22efe',sourceVersion:1,sha256:'7a08ed0cbcc8f2d4a8c0e54a64770d31c73d0920576adec015bfcafd2b03a2ea',byteLength:75191};
export function attendancePublication(model:NonNullable<GlobalSettings['documentModels']>[string]|undefined):{artifact?:PublicBlankPdfArtifact;bootstrap:boolean}|null{
  if(!model?.driveFileId||!model.contentSha256)return null;
  const version=model.activeVersion||1;
  if(model.publicPdf?.sourceContentSha256===model.contentSha256&&model.publicPdf.sourceVersion===version&&/^[a-zA-Z0-9_-]{10,}$/.test(model.publicPdf.driveFileId)&&Number.isInteger(model.publicPdf.byteLength)&&model.publicPdf.byteLength>0&&model.publicPdf.byteLength<=2*1024*1024&&/^[a-f0-9]{64}$/.test(model.publicPdf.sha256))return{artifact:model.publicPdf,bootstrap:false};
  if(model.publicPdf)return null;
  if(model.driveFileId===attendanceBootstrap.sourceFileId&&model.contentSha256===attendanceBootstrap.sourceContentSha256&&version===attendanceBootstrap.sourceVersion)return{bootstrap:true};
  return null;
}
let cached:{hash:string;bytes:Buffer}|undefined;
let pending:{hash:string;promise:Promise<Buffer>}|undefined;
export async function publishedAttendanceBytes(publication:NonNullable<ReturnType<typeof attendancePublication>>,rootFolderId?:string):Promise<Buffer>{
  const expected=publication.artifact||attendanceBootstrap;
  if(cached?.hash===expected.sha256)return cached.bytes;
  if(pending?.hash===expected.sha256)return pending.promise;
  const promise=(async()=>{
    const bytes=publication.bootstrap?readFileSync(path.join(process.cwd(),'server/documents/assets/attendance-declaration-v1.pdf')):await readAttendanceReferencePdf(publication.artifact!,rootFolderId);
    if(bytes.length!==expected.byteLength||bytes.subarray(0,5).toString()!=='%PDF-'||createHash('sha256').update(bytes).digest('hex')!==expected.sha256)throw new Error('PDF público não corresponde à versão aprovada.');
    cached={hash:expected.sha256,bytes};return bytes;
  })();
  pending={hash:expected.sha256,promise};
  try{return await promise;}finally{if(pending?.promise===promise)pending=undefined;}
}

/** Identity of this exact approved publication, excluding mutable presentation labels. */
export function sameAttendancePublication(expected:any,actual:any):boolean{
  if(!expected?.publicPdf||!actual?.publicPdf)return false;
  return ['activeVersion','driveFileId','contentSha256'].every(key=>expected[key]===actual[key])
    &&['driveFileId','sha256','byteLength','sourceContentSha256','sourceVersion'].every(key=>expected.publicPdf[key]===actual.publicPdf[key]);
}
