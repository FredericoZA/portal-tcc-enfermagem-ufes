import type { GlobalSettings, ProcessData } from '../../src/types';
import { acceptEvaluationAnswers, evaluationReviewRows, EVALUATION_OUTCOMES } from '../../src/utils/evaluationForm';

export class EvaluationError extends Error {
  constructor(message: string, public status: number, public code: string) { super(message); }
}
export function acceptEvaluation(process: ProcessData, input: any, settings: GlobalSettings, actorEmail: string, now = new Date(), options:{previewOnly?:boolean}={}) {
  if (input?.dataConfirmed !== true) throw new EvaluationError('Confira os dados do aluno e marque a confirmação antes de registrar o conceito e o parecer.', 400, 'DATA_REVIEW_REQUIRED');
  if (!Number.isInteger(input.expectedDataRevision) || input.expectedDataRevision !== process.dataRevision) throw new EvaluationError('Os dados do TCC foram atualizados. Recarregue e confira a versão atual.', 409, 'STALE_DATA_REVIEW');
  if (input.expectedSchemaRevision !== (settings.integrationStudio?.revision || 0)) throw new EvaluationError('O formulário foi atualizado pelo Master. Recarregue e confira os campos atuais.', 409, 'STALE_EVALUATION_FORM');
  const defenseAt = Date.parse(process.defesa.startAt);
  if (!options.previewOnly && (!Number.isFinite(defenseAt) || defenseAt > now.getTime())) throw new EvaluationError('O conceito e o parecer só podem ser registrados a partir do horário agendado para a defesa.', 409, 'DEFENSE_NOT_STARTED');
  let values: ReturnType<typeof acceptEvaluationAnswers>;
  try { values = acceptEvaluationAnswers(input, EVALUATION_OUTCOMES, settings.integrationStudio); }
  catch (error) { throw new EvaluationError(error instanceof Error ? error.message : 'Registro de conceito e ata inválido.', 400, 'INVALID_EVALUATION'); }
  const attendance=values.answers.COORIENTADOR_PRESENTE;
  if (process.coorientador && attendance!=='Sim' && attendance!=='Não') throw new EvaluationError('Informe se o coorientador participou da sessão de defesa.',400,'COADVISOR_ATTENDANCE_REQUIRED');
  if (!process.coorientador && attendance==='Sim') throw new EvaluationError('Este trabalho não possui coorientador cadastrado.',400,'INVALID_COADVISOR_ATTENDANCE');
  if (!process.coorientador) delete values.answers.COORIENTADOR_PRESENTE;
  let documentText:string|undefined;
  if(input.documentText!==undefined){
    if(typeof input.documentText!=='string'||input.documentText.trim().length<50||input.documentText.length>60000||/[\u0000-\u0008\u000e-\u001f]/.test(input.documentText))throw new EvaluationError('O texto integral da ata deve ter entre 50 e 60.000 caracteres válidos.',400,'INVALID_DOCUMENT_TEXT');
    documentText=input.documentText.replace(/\r\n?/g,'\n').trim();
  }
  return {
    ...values,
    coadvisorPresent:Boolean(process.coorientador && attendance==='Sim'),
    ...(documentText!==undefined?{documentText}:{}),
    dataReview: {
      sourceDataRevision: process.dataRevision,
      formRevision: settings.integrationStudio?.revision || 0,
      confirmedAt: now.toISOString(),
      confirmedBy: actorEmail,
      fields: evaluationReviewRows(process, settings.integrationStudio),
    },
  };
}
