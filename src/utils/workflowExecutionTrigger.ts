/** Only events emitted by the normal process may start a configured activity. */
export const WORKFLOW_EXECUTION_EVENTS = [
  ['TCC_CREATED', 'Criação do processo'],
  ['LOCATION_CONFIRMED', 'Confirmação do local'],
  ['INVITATION_SENT', 'Envio do convite'],
  ['EVALUATION_SUBMITTED', 'Registro de conceito e ata'],
  ['REPOSITORY_SUBMITTED', 'Entrega do repositório'],
  ['SIGNATURE_REQUESTED', 'Solicitação de assinatura'],
  ['SIGNATURE_COMPLETED', 'Conclusão de assinatura'],
  ['PUBLICATION_CLEARED', 'Ata e termo aplicável assinados e arquivados'],
  ['PROCESS_COMPLETED', 'Conclusão do processo'],
] as const;
export function workflowExecutionEvent(action: {executionEvent?: unknown}, stageEvent: string): string {
  return String(action.executionEvent || stageEvent).trim().toUpperCase();
}
export function isWorkflowExecutionEvent(value: unknown): boolean {
  return WORKFLOW_EXECUTION_EVENTS.some(([event]) => event === value);
}
