export interface AccessImportRecord { nome: string; email: string; matricula?: string; row?: number; }
export interface AccessImportIssue { row: number; reason: string; }

/** Shared by preview and API: a Master access list is not a TCC registration. */
export function accessImportIssues(records: AccessImportRecord[]): AccessImportIssue[] {
  const seen = new Set<string>();
  return records.flatMap((record, index) => {
    const email = String(record.email || '').trim().toLowerCase();
    const reasons: string[] = [];
    if (!String(record.nome || '').trim()) reasons.push('Informe o nome');
    if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)) reasons.push('E-mail inválido');
    if (seen.has(email) && email) reasons.push('E-mail repetido na lista');
    seen.add(email);
    return reasons.length ? [{ row: record.row || index + 1, reason: reasons.join('; ') }] : [];
  });
}
