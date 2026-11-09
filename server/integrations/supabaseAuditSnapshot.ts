/**
 * Recompõe o histórico append-only a partir dos chunks da RPC
 * portal_read_runtime_snapshot_v1. Um chunk ausente ou inválido nunca
 * se transforma em histórico vazio; a leitura falha fechada.
 *
 * O cache é por instância e por projeto. Não substitui o banco como
 * fonte autoritativa nem usa dados globais compartilhados entre projetos.
 */
export type AuditChunk = { fingerprint: string; events?: unknown[] };
export type AuditDeltaRow = {
  revision: number;
  payload: Record<string,unknown>;
  audit_chunks: AuditChunk[] | null;
};

export class AuditSnapshotAssembler {
  private namespace = '';
  private chunks = new Map<string, unknown[]>();

  fingerprints(namespace:string):string[]{
    this.activate(namespace);
    return Array.from(this.chunks.keys()).slice(0,5000);
  }

  reconstruct(namespace:string,rows:unknown):AuditDeltaRow {
    this.activate(namespace);
    if(!Array.isArray(rows)||rows.length!==1)throw new Error('Snapshot de auditoria inválido.');
    const row=rows[0] as Partial<AuditDeltaRow>;
    const revision=Number(row?.revision);
    if(!Number.isSafeInteger(revision)||revision<1||!row.payload||Array.isArray(row.payload)||typeof row.payload!=='object'){
      throw new Error('Snapshot de auditoria sem revisão e dados válidos.');
    }
    if(row.audit_chunks===null){
      return {revision,payload:row.payload,audit_chunks:null};
    }
    if(!Array.isArray(row.audit_chunks)||row.audit_chunks.length>5000)throw new Error('Lista de blocos de auditoria inválida.');
    const nextCache=new Map<string,unknown[]>();
    const history:unknown[]=[];
    for(const chunk of row.audit_chunks){
      const fingerprint=String(chunk?.fingerprint||'');
      if(!/^[a-f0-9]{64}$/.test(fingerprint)||nextCache.has(fingerprint))throw new Error('Identificador de bloco de auditoria inválido.');
      const events=Array.isArray(chunk?.events)?chunk.events:this.chunks.get(fingerprint);
      if(!Array.isArray(events))throw new Error('Bloco de auditoria ausente. Recarga autoritativa necessária.');
      if(history.length+events.length>50000)throw new Error('Limite de auditoria excedido.');
      nextCache.set(fingerprint,events);
      history.push(...events);
    }
    // Commit do cache somente depois de reconstituir TODOS os blocos.
    this.chunks=nextCache;
    return {revision,payload:{...row.payload,auditLogs:history},audit_chunks:row.audit_chunks};
  }

  private activate(namespace:string):void{
    if(this.namespace!==namespace){
      this.namespace=namespace;
      this.chunks=new Map();
    }
  }
}
