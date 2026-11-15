/** Only the unfiltered page is optimized; search/export keep their full contract. */
export function canReadPagedAudit(method:string,path:string,query:Record<string,unknown>):boolean {
  return method==='GET'&&path==='/admin/audit-logs'&&query.paginated==='true'&&
    !query.q&&!query.search&&!query.start&&!query.end&&!query.focusId&&(!query.kind||query.kind==='all');
}
