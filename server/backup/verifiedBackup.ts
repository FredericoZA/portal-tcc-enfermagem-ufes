import {createHash} from 'node:crypto';
import {encryptPortalBackupPayload,decryptPortalBackupPayload} from '../integrations/integrationSecrets';
import {getGoogleWorkspaceAccessToken,storePrivatePortalBackup,readPrivatePortalBackup} from '../integrations/googleWorkspace';
interface Snapshot {settings?:unknown;processes?:Array<{id:string;protocolo:string}>;memberships?:unknown[];authorizedStudents?:unknown[];studioVersions?:unknown[]}
interface Dependencies {
 token:()=>Promise<string>;
 store:typeof storePrivatePortalBackup;
 read:typeof readPrivatePortalBackup;
}
const defaults:Dependencies={token:getGoogleWorkspaceAccessToken,store:storePrivatePortalBackup,read:readPrivatePortalBackup};
const sha=(value:string|Buffer)=>createHash('sha256').update(value).digest('hex');
/** Verifies an encrypted off-database copy without restoring live business state. */
export async function createVerifiedPortalBackup(snapshot:Snapshot,rootFolderId:string,dependencies:Dependencies=defaults,now=new Date()){
 if(!rootFolderId)throw new Error('Defina a pasta raiz privada do Drive antes de executar o backup.');
 const serialized=JSON.stringify(snapshot);const checksum=sha(serialized);const encrypted=encryptPortalBackupPayload(serialized);const encryptedSha256=sha(encrypted);
 const accessToken=await dependencies.token();const stamp=now.toISOString().replace(/[:.]/g,'-');
 const stored=await dependencies.store({accessToken,rootFolderId,fileName:`PORTAL_TCC_BACKUP_${stamp}.ptb`,content:encrypted,sha256:encryptedSha256});
 const reread=await dependencies.read(accessToken,stored.id);
 if(sha(reread)!==encryptedSha256)throw new Error('O backup relido do Drive diverge do arquivo cifrado enviado.');
 const roundTrip=JSON.parse(decryptPortalBackupPayload(reread)) as Snapshot;
 if(!roundTrip.settings||!Array.isArray(roundTrip.processes)||roundTrip.processes.some(process=>!process.id||!process.protocolo)||new Set(roundTrip.processes.map(process=>process.id)).size!==roundTrip.processes.length||sha(JSON.stringify(roundTrip))!==checksum)throw new Error('O backup não passou na validação de restauração isolada.');
 return {id:`drill-${now.getTime()}`,executedAt:now.toISOString(),schemaVersion:4,backupFileId:stored.id,backupFileUrl:stored.webViewLink,encryptedSha256,sourceSha256:checksum,checksumValid:true,driveRoundTrip:true,restorable:true,counts:{processes:roundTrip.processes.length,memberships:roundTrip.memberships?.length||0,authorized:roundTrip.authorizedStudents?.length||0,studioVersions:roundTrip.studioVersions?.length||0},issues:[] as string[]};
}
