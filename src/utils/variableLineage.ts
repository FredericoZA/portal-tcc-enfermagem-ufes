import type { IntegrationStudioSettings } from '../types/integrationStudio';
import { canonicalKey, REGISTRATION_QUESTIONS, operationalConfig } from './operationalConfig';
export function variableLineage(studio: Partial<IntegrationStudioSettings>) {
  const map = new Map<string, { key: string; origins: Set<string>; uses: Set<string> }>();
  const add = (key: string, kind: 'origins' | 'uses', label: string) => { const normalized = canonicalKey(key); if (!normalized) return; const row = map.get(normalized) || { key: normalized, origins: new Set<string>(), uses: new Set<string>() }; row[kind].add(label); map.set(normalized,row); };
  for (const q of REGISTRATION_QUESTIONS) add(q.fieldKey,'origins',`Cadastro: ${q.label}`);
  const scan = (source: unknown, label: string) => {
    const text = typeof source === 'string' ? source : JSON.stringify(source);
    for (const m of text.matchAll(/\{\{([^{}]+)\}\}|<<([^<>]+)>>|\[\[([^\[\]]+)\]\]|-((?:CAMPO_)[A-Z0-9_]+)-/g)) add(m[1]||m[2]||m[3]||m[4], 'uses', label);
  };
  for (const form of studio.formTemplates || []) for (const q of (Array.isArray(form.questions)?form.questions:[]) as any[]) {
    add(q.fieldKey, 'origins', String(form.title));
    if(q.visibleWhen?.fieldKey)add(q.visibleWhen.fieldKey,'uses',`Condição do campo: ${q.label}`);
  }
  for (const doc of studio.docTemplates || []) scan(doc.variables || [],`Documento: ${doc.label}`);
  for (const mail of studio.emailTemplates || []) scan([mail.recipient,mail.subject,mail.body,mail.htmlBody],`E-mail: ${mail.name}`);
  for (const stage of studio.workflowStages || []) for (const action of (Array.isArray(stage.actions)?stage.actions:[]) as any[]) if (action.condition?.fieldKey) add(action.condition.fieldKey,'uses',`Fluxo: ${stage.title} → ${action.title}`);
  for (const [artifact,rules] of Object.entries(operationalConfig(studio).presentations)) for (const rule of rules) { add(rule.source,'uses',`${artifact}: marcador ${rule.marker} (${rule.format})`); add(rule.marker,'origins',`Formatação de ${rule.source}`); }
  for (const field of ['AREA_TEMATICA','TEMA_PRINCIPAL','TIPO_DE_ESTUDO','FINALIDADE_DO_TRABALHO','PALAVRAS_CHAVE']) add(field,'uses','Panorama estatístico e qualidade dos dados');
  for (const field of ['PROTOCOLO','ALUNO_1_NOME','ALUNO_2_NOME']) add(field,'uses','Nome dos arquivos do Drive (primeiro nome do autor)');
  return [...map.values()].sort((a,b)=>a.key.localeCompare(b.key)).map(row=>({ key:row.key, origins:[...row.origins],uses:[...row.uses] }));
}
