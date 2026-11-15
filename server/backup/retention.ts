import {createVerifiedPortalBackup} from './verifiedBackup';
import {listRetirableRuntimeBackups,finalizeRuntimeBackupArchive} from '../integrations/supabase';
export async function archiveRetiredRuntimeBackups(rootFolderId:string,ports={list:listRetirableRuntimeBackups,backup:createVerifiedPortalBackup,finalize:finalizeRuntimeBackupArchive}){
 if(!rootFolderId)return {archived:0,retained:true};
 const rows=await ports.list();let archived=0;
 if(rows.length>2)throw Error('Lote de retenção excedeu o limite.');
 for(const row of rows){
  // Preserve the complete payload AND the original provenance in the encrypted archive.
  const snapshot={...row.payload,retentionSource:{backupId:row.backup_id,revision:row.revision,reason:row.reason,createdAt:row.created_at,payloadSha256:row.payload_sha256}};
  const proof=await ports.backup(snapshot,rootFolderId);
  if(!proof.restorable||!proof.driveRoundTrip||!proof.checksumValid)throw Error('Backup original preservado: restauração não confirmada.');
  const done=await ports.finalize({backupId:row.backup_id,payloadSha256:row.payload_sha256,driveFileId:proof.backupFileId,encryptedSha256:proof.encryptedSha256,sourceSha256:proof.sourceSha256});
  if(done!==true)throw Error('Banco não confirmou retenção.');archived++;
 }
 return {archived,retained:true};
}
