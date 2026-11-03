import type {GlobalSettings} from '../../src/types';
import type {DriveModelFingerprint} from '../integrations/googleWorkspace';
type Model=NonNullable<GlobalSettings['documentModels']>[string];
/** Publish exactly the file and bytes reviewed by the administrator, preserving history. */
export function publishReviewedModel(model:Model,current:DriveModelFingerprint,review:{fileId:string;version:number;sha256:string},actor:string,now:string):Model{
  if(review.fileId!==model.driveFileId||review.version!==(model.activeVersion||1)||!/^[a-f0-9]{64}$/.test(review.sha256)||review.sha256!==current.contentSha256)throw new Error('O modelo mudou depois da prévia. Revise a versão atual antes de publicar.');
  const previous=model.versions?.length?model.versions:[{version:model.activeVersion||1,fileName:model.fileName,driveFileId:model.driveFileId,driveFileUrl:model.driveFileUrl,variables:model.variables,uploadedAt:model.uploadedAt,uploadedBy:model.uploadedBy,contentSha256:model.contentSha256,driveRevisionId:model.driveRevisionId,driveModifiedTime:model.driveModifiedTime}];
  const version=Math.max(model.activeVersion||1,...previous.map(item=>item.version))+1;
  const next={version,fileName:model.fileName,driveFileId:model.driveFileId,driveFileUrl:model.driveFileUrl,variables:model.variables,uploadedAt:now,uploadedBy:actor,...current};
  return {...model,...current,activeVersion:version,uploadedAt:now,uploadedBy:actor,versions:[...previous,next].slice(-30)};
}
