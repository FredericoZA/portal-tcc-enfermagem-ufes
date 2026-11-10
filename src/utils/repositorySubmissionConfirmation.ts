import type {ProcessData} from '../types';

export interface RepositorySubmissionFields {
  palavrasChave:string[];
  resumoSintese:string;
  publishFullWork:boolean;
  publishExpandedAbstract:boolean;
  workType:string;
}

/** A fresh authorized read may confirm a lost reply, never an unsaved form. */
export function repositorySubmissionConfirmed(previous:ProcessData,current:ProcessData,fields:RepositorySubmissionFields,authorEmail:string):boolean {
  const saved=current.acervo;
  return current.id===previous.id&&current.dataRevision>previous.dataRevision
    &&Boolean(saved?.submittedAt)&&saved?.submittedAt!==previous.acervo?.submittedAt
    &&saved?.submittedBy?.trim().toLowerCase()===authorEmail.trim().toLowerCase()
    &&saved.resumoSintese===fields.resumoSintese
    &&JSON.stringify(saved.palavrasChave)===JSON.stringify(fields.palavrasChave)
    &&Boolean(saved.publishFullWork)===fields.publishFullWork
    &&Boolean(saved.publishExpandedAbstract)===fields.publishExpandedAbstract
    &&saved.workType===fields.workType
    &&saved.trabalhoCompletoFileId===previous.acervo?.trabalhoCompletoFileId
    &&saved.resumoExpandidoFileId===previous.acervo?.resumoExpandidoFileId
    &&saved.trabalhoCompletoSha256===previous.acervo?.trabalhoCompletoSha256
    &&saved.trabalhoCompletoVersion===previous.acervo?.trabalhoCompletoVersion
    &&saved.resumoExpandidoSha256===previous.acervo?.resumoExpandidoSha256
    &&saved.resumoExpandidoVersion===previous.acervo?.resumoExpandidoVersion;
}
