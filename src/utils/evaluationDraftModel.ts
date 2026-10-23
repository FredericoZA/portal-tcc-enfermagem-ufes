export interface AtaDraftModel { documentText?:string; modelFingerprint?:string; documentTextReset?:boolean }
export function ataModelFingerprint(model?:{driveFileId?:string;contentSha256?:string}):string {
  return model?.contentSha256?`${model.driveFileId||''}:${model.contentSha256}`:'';
}
export function recoverEvaluationDocument<T extends AtaDraftModel>(draft:T|null|undefined,currentFingerprint:string):T|null {
  if(!draft)return null;
  if(!draft.documentText||draft.modelFingerprint===currentFingerprint)return {...draft,modelFingerprint:currentFingerprint};
  return {...draft,documentText:undefined,modelFingerprint:currentFingerprint,documentTextReset:true};
}
