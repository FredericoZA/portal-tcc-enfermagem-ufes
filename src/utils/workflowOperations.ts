import type { IntegrationStudioSettings } from '../types/integrationStudio';
import type { WorkflowOperationsPolicy, RegistrationFinding } from '../types/workflowOperations';
import type { RegistrationAnswers } from '../types/operationalConfig';
export const DEFAULT_WORKFLOW_OPERATIONS: WorkflowOperationsPolicy = {
  draftExpiryDays: 30, holidays: [], weekdays: [1,2,3,4,5], deadlines: [],
  identity: { minimumStudentIdLength: 5, siapeLength: 7 },
  documentLayout: { signatureReservePoints: 90, maximumPages: 20 }
};
export function workflowPolicy(studio?: Partial<IntegrationStudioSettings>): WorkflowOperationsPolicy {
  const stored = studio?.operationalConfig?.workflow;
  return {
    ...DEFAULT_WORKFLOW_OPERATIONS,
    ...stored,
    holidays: Array.isArray(stored?.holidays) ? stored.holidays : DEFAULT_WORKFLOW_OPERATIONS.holidays,
    weekdays: Array.isArray(stored?.weekdays) ? stored.weekdays : DEFAULT_WORKFLOW_OPERATIONS.weekdays,
    deadlines: Array.isArray(stored?.deadlines) ? stored.deadlines : DEFAULT_WORKFLOW_OPERATIONS.deadlines,
    identity: { ...DEFAULT_WORKFLOW_OPERATIONS.identity, ...stored?.identity },
    documentLayout: { ...DEFAULT_WORKFLOW_OPERATIONS.documentLayout, ...stored?.documentLayout }
  };
}
export function registrationFindings(answers: RegistrationAnswers, policy = DEFAULT_WORKFLOW_OPERATIONS): RegistrationFinding[] {
  const findings: RegistrationFinding[] = [];
  const names: Array<[string,string]> = [];
  for (const [key, raw] of Object.entries(answers)) {
    const value = String(raw ?? '').trim(); if (!value) continue;
    if (/_NOME$/.test(key)) {
      if (value.split(/\s+/).length < 2 || /\d/.test(value)) findings.push({ fieldKey:key, message:'Confira o nome completo, sem matrícula ou números no campo.', severity:'WARNING' });
      if (/\s{2,}/.test(String(raw))) findings.push({ fieldKey:key, message:'Há espaços repetidos no nome. Confira antes de emitir documentos.', severity:'WARNING' });
      const normalized = value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
      const previous = names.find(([,name]) => name === normalized);
      if(previous) findings.push({fieldKey:key,message:`O mesmo nome aparece em ${previous[0]}. Confira os papéis e os e-mails.`,severity:'WARNING'});
      names.push([key,normalized]);
    }
    if (/ALUNO_\d_MATRICULA$/.test(key) && value.length < policy.identity.minimumStudentIdLength) findings.push({fieldKey:key,message:`Matrícula abaixo de ${policy.identity.minimumStudentIdLength} caracteres. Confira se está completa.`,severity:'WARNING'});
    if(/_SIAPE$/.test(key) && (!/^\d+$/.test(value)||value.length!==policy.identity.siapeLength)) findings.push({fieldKey:key,message:`Confira o SIAPE: o padrão publicado é de ${policy.identity.siapeLength} algarismos.`,severity:'WARNING'});
  }
  return findings;
}
