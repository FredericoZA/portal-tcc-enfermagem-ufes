import type { IntegrationStudioSettings } from '../../src/types/integrationStudio';
import type { ProcessData, SignatureJob } from '../../src/types';
import { compileWorkflow, executeWorkflowEvent } from './runtime';
import { declarationReady } from './gates';
import { presentVariables, operationalConfig } from '../../src/utils/operationalConfig';
import { validateCourseStudio } from '../../src/utils/courseStudioValidator';

export async function simulateWorkflow(studio: IntegrationStudioSettings, scenario: { publication?: boolean; secondAuthor?: boolean; locationConfirmed?: boolean; failActionId?: string } = {}) {
  const p: ProcessData = {
    id: 'simulation', protocolo: 'TCC-SIMULACAO-001', titulo: 'Pesquisa fictícia para validação do fluxo', createdByEmail: 'aluno@example.invalid',
    aluno1: { nome: 'Aluno de Demonstração', email: 'aluno@example.invalid', matricula: '0000001' },
    aluno2: scenario.secondAuthor ? { nome: 'Segunda Autora de Demonstração', email: 'autora@example.invalid', matricula: '0000002' } : null,
    orientador: { nome: 'Orientador de Demonstração', email: 'orientador@example.invalid', siape: '0000000' }, coorientador: null,
    banca: [2,3].map(n => ({ id: `b-${n}`, nome: `Avaliador Fictício ${n}`, email: `banca${n}@example.invalid`, funcao: `EXAMINER_${n}` as any })),
    defesa: { startAt: '2026-09-01T17:00:00Z', endAt: '2026-09-01T18:30:00Z', local: operationalConfig(studio).reservation.locations[0], alternateLocation: operationalConfig(studio).reservation.locations[1], localStatus: 'PENDENTE' },
    avaliacao: { status: 'PENDENTE' }, status: 'AGUARDANDO_CONFIRMACAO_LOCAL', etapaAtual: 'CONFIRMACAO_LOCAL', dataRevision: 1, createdAt: '2026-08-01T12:00:00Z', updatedAt: '2026-08-01T12:00:00Z'
  };
  const events: Array<{ event: string; role: string; state: string; details?: unknown }> = [];
  const emails: Array<{ to: string[]; subject: string; text: string; html?: string; attachments: unknown }> = [];
  const jobs: SignatureJob[] = [];
  let failed = false;
  const advance = async (event: string, role: string) => {
    const run = await executeWorkflowEvent(studio, { process: p, actorEmail: 'simulation@example.invalid', actorRoles: [], eventCode: event, extraVariables: { DEPARTAMENTO_EMAIL: 'departamento@example.invalid' } }, {
      createDocument: async ({ template, variables }) => {
        const type = String(template.type || '').toUpperCase();
        const stage = compileWorkflow(studio).stages.find(s => s.eventCode === event);
        if (stage?.actions.some(a => a.referenceId === template.id && a.id === scenario.failActionId)) throw new Error('Falha temporária simulada; retome a partir desta ação.');
        if (type === 'CONVITE' && p.defesa.localStatus !== 'CONFIRMADO') throw new Error('Local ainda não confirmado.');
        if (type === 'DECLARACAO' && !declarationReady(p, jobs)) throw new Error('Assinaturas anteriores pendentes.');
        presentVariables(variables, String(template.id), studio);
        if (type !== 'CONVITE') jobs.push({ id: `sim-${type}`, processId: p.id, documentType: type, documentVersion: 1, sourceDataRevision: p.dataRevision, status: 'SENT' } as SignatureJob);
        return { externalId: `simulation-document-${template.id}` };
      },
      createFormTask: async ({ form }) => ({ externalId: `simulation-form-${form.id}` }),
      sendEmail: async input => { emails.push({ to: input.to, subject: input.subject, text: input.text, html: input.html, attachments: input.template.attachments || [] }); return { externalId: 'simulation-email' }; }
    });
    events.push({ event, role, state: run.status, details: run.actions });
    failed = run.status !== 'COMPLETED';
  };
  await advance('TCC_CREATED', 'Aluno');
  if (!failed && scenario.locationConfirmed === false) events.push({ event: 'LOCATION_CONFIRMED', role: 'Aluno', state: 'BLOQUEADO: aguarda confirmação recebida do departamento' });
  else if (!failed) {
    p.defesa.localStatus = 'CONFIRMADO';
    await advance('LOCATION_CONFIRMED', 'Aluno');
    if (!failed) { p.defesa.invitationSentAt = '2026-08-02T12:00:00Z'; await advance('INVITATION_SENT', 'Banca: ciência e consulta'); }
    if (!failed) { p.avaliacao = { status: 'CONCLUIDO', resultadoLabel: 'Aprovado', parecer: 'Parecer fictício' }; await advance('EVALUATION_SUBMITTED', 'Orientador'); }
    const ata = jobs.find(j => j.documentType === 'ATA');
    if (!failed && ata) {
      events.push({ event: 'ATA_ASSINADA', role: 'Orientador', state: 'RETORNO SIMULADO DA ASTEN E ARQUIVAMENTO' });
      ata.status = 'ARCHIVED'; ata.driveSignedFileId = 'simulation-ata';
      p.acervo = { submittedAt: '2026-09-02T12:00:00Z', publishFullWork: scenario.publication !== false, authorizationConfirmedAt: '2026-09-02T12:00:00Z' };
      await advance('REPOSITORY_SUBMITTED', 'Aluno');
      const term = jobs.find(j => j.documentType === 'TERMO');
      if (!failed && term) { term.status = 'ARCHIVED'; term.driveSignedFileId = 'simulation-term'; events.push({ event: 'TERMO_ASSINADO', role: 'Aluno(s) e orientador', state: 'ASSINATURAS PARALELAS SIMULADAS' }); }
      if (!failed && declarationReady(p, jobs)) await advance('PUBLICATION_CLEARED', 'Presidente');
      const declaration = jobs.find(j => j.documentType === 'DECLARACAO');
      if (!failed && declaration) { declaration.status = 'ARCHIVED'; await advance('PROCESS_COMPLETED', 'Presidente e participantes'); }
    }
  }
  return { simulated: true, externalEffects: false, validation: validateCourseStudio(studio), events, emails, note: 'Usa o executor real com portas locais. Não testa credenciais, conversão de DOCX nem assinaturas reais. Endereços apenas exibidos; nenhum e-mail é enviado.' };
}
