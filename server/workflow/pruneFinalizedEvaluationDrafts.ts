/** Conservatively purge only redundant evaluation autosaves after final TCC closure.
 * The verified canonical Drive/archive record is a strict prerequisite.
 * Process records, documents, signed artifacts and formal audit are untouched.
 */
export function pruneFinalizedEvaluationDrafts<
  P extends {id:string;status:string;avaliacao:{status:string};acervo?:{submittedAt?:string}},
  D
>(processes:readonly P[],drafts:Map<string,D>,isArchived:(process:P)=>boolean):number{
  let removed=0;
  for(const process of processes){
    if(process.status!=='CONCLUIDO'||process.avaliacao.status!=='CONCLUIDO'||
      !process.acervo?.submittedAt||!isArchived(process))continue;
    if(drafts.delete(process.id))removed++;
  }
  return removed;
}
