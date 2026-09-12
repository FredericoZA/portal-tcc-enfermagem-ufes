import type { GlobalSettings, ProcessData } from '../../src/types';
import { acceptEvaluationAnswers, evaluationReviewRows } from '../../src/utils/evaluationForm';

export class EvaluationError extends Error {
  constructor(message: string, public status: number, public code: string) { super(message); }
}
export function acceptEvaluation(process: ProcessData, input: any, settings: GlobalSettings, actorEmail: string, now = new Date()) {
  if (input?.dataConfirmed !== true) throw new EvaluationError('Confira os dados do aluno e marque a confirmação antes de registrar a avaliação.', 400, 'DATA_REVIEW_REQUIRED');
  if (!Number.isInteger(input.expectedDataRevision) || input.expectedDataRevision !== process.dataRevision) throw new EvaluationError('Os dados do TCC foram atualizados. Recarregue e confira a versão atual.', 409, 'STALE_DATA_REVIEW');
  if (input.expectedSchemaRevision !== (settings.integrationStudio?.revision || 0)) throw new EvaluationError('O formulário foi atualizado pelo Master. Recarregue e confira os campos atuais.', 409, 'STALE_EVALUATION_FORM');
  const defenseAt = Date.parse(process.defesa.startAt);
  if (!Number.isFinite(defenseAt) || defenseAt > now.getTime()) throw new EvaluationError('A avaliação só pode ser registrada a partir do horário agendado para a defesa.', 409, 'DEFENSE_NOT_STARTED');
  let values: ReturnType<typeof acceptEvaluationAnswers>;
  try { values = acceptEvaluationAnswers(input, settings.evaluationOutcomeOptions, settings.integrationStudio); }
  catch (error) { throw new EvaluationError(error instanceof Error ? error.message : 'Avaliação inválida.', 400, 'INVALID_EVALUATION'); }
  return {
    ...values,
    dataReview: {
      sourceDataRevision: process.dataRevision,
      formRevision: settings.integrationStudio?.revision || 0,
      confirmedAt: now.toISOString(),
      confirmedBy: actorEmail,
      fields: evaluationReviewRows(process, settings.integrationStudio),
    },
  };
}
