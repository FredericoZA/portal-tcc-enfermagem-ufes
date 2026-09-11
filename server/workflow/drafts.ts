import type { RegistrationDraft } from '../../src/types/workflowOperations';
import type { RegistrationAnswers } from '../../src/types/operationalConfig';
import type { IntegrationStudioSettings } from '../../src/types/integrationStudio';
import { registrationQuestions } from '../../src/utils/operationalConfig';
import { workflowPolicy } from '../../src/utils/workflowOperations';
export class DraftConflict extends Error { status = 409; }
export function saveRegistrationDraft(previous: RegistrationDraft|undefined, input: any, owner: string, studio?: Partial<IntegrationStudioSettings>, now = new Date()): RegistrationDraft {
  const existing = previous && Date.parse(previous.expiresAt)>now.getTime() ? previous : undefined;
  if (!Number.isInteger(input?.expectedRevision) || input.expectedRevision !== (existing?.revision || 0)) throw new DraftConflict('O rascunho mudou em outra aba. Recarregue antes de salvar para preservar as duas versões.');
  if(input?.schemaRevision !== Number(studio?.revision || 0)) throw new DraftConflict('O formulário publicado mudou. Recarregue e confira os campos antes de salvar.');
  if(!input?.answers || typeof input.answers !== 'object' || Array.isArray(input.answers)) throw new Error('Rascunho inválido.');
  const answers: RegistrationAnswers = {};
  for (const question of registrationQuestions(studio)) {
    const value = input.answers[question.fieldKey];
    if(value===undefined) continue;
    if(!['string','number','boolean'].includes(typeof value)||String(value).length>10000) throw new Error(`Valor inválido em ${question.label}.`);
    answers[question.fieldKey]=value;
  }
  // A draft can never impersonate a different authenticated first author.
  answers.ALUNO_1_EMAIL=owner;
  if(Buffer.byteLength(JSON.stringify(answers),'utf8')>150000)throw new Error('O rascunho excede o tamanho permitido.');
  const days = workflowPolicy(studio).draftExpiryDays;
  return {ownerEmail:owner,answers,section:Math.max(0,Math.min(30,Math.floor(Number(input.section)||0))),revision:(existing?.revision||0)+1,schemaRevision:Number(studio?.revision||0),updatedAt:now.toISOString(),expiresAt:new Date(now.getTime()+days*86400000).toISOString()};
}
export function pruneDrafts(drafts: Record<string,RegistrationDraft>, now = new Date()): Record<string,RegistrationDraft> {
  return Object.fromEntries(Object.entries(drafts).filter(([,draft])=>Date.parse(draft.expiresAt)>now.getTime()));
}
