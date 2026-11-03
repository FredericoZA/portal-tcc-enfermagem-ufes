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
export function registrationParticipantLabel(key:string):string {
 const role=key.startsWith('ALUNO_')?'Autor':key.startsWith('COORIENTADOR')?'Coorientador':key.startsWith('ORIENTADOR')?'Orientador':key.startsWith('EXAMINADOR_')?'Examinador':'';
 return role ? `${role} (${'EMAIL'===key.split('_').at(-1)?'e-mail':'nome'})` : key;
}
export function registrationFindings(answers: RegistrationAnswers, policy = DEFAULT_WORKFLOW_OPERATIONS): RegistrationFinding[] {
  const findings: RegistrationFinding[] = [];
  const names: Array<[string,string]> = [];
  const emails=new Map<string,string>();
  for (const [key, raw] of Object.entries(answers)) {
    const value = String(raw ?? '').trim(); if (!value) continue;
    if(/^(ALUNO_[12]|ORIENTADOR|COORIENTADOR|EXAMINADOR_[23])_EMAIL$/.test(key)){const normalized=value.toLowerCase();const previous=emails.get(normalized);if(previous)findings.push({fieldKey:key,message:`O e-mail ${value} também foi informado para ${registrationParticipantLabel(previous).replace(' (e-mail)','').toLowerCase()}. Cada participante deve usar um e-mail diferente. Corrija antes de cadastrar.`,severity:'ERROR'});emails.set(normalized,key);}
    if (/_NOME$/.test(key)) {
      if (value.split(/\s+/).length < 2 || /\d/.test(value)) findings.push({ fieldKey:key, message:'Confira o nome completo, sem matrícula ou números no campo.', severity:'WARNING' });
      if (/\s{2,}/.test(String(raw))) findings.push({ fieldKey:key, message:'Há espaços repetidos no nome. Confira antes de emitir documentos.', severity:'WARNING' });
      const normalized = value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
      const previous = names.find(([,name]) => name === normalized);
      if(previous) findings.push({fieldKey:key,message:`O nome ${value} também foi informado para ${registrationParticipantLabel(previous[0]).replace(' (nome)','').toLowerCase()}. Confira se são pessoas distintas e corrija os dados, se necessário.`,severity:'WARNING'});
      names.push([key,normalized]);
    }
  }
  return findings;
}
