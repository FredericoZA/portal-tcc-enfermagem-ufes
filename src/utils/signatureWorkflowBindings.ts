/** Signature recipients are role bindings, resolved by the server for each TCC. */
export const signatureWorkflowBindings = {
  ATA: {
    label: 'Assinatura da ata', event: 'EVALUATION_SUBMITTED',
    recipient: 'Orientador · e-mail cadastrado no TCC',
    source: 'Dados do processo → Orientador → E-mail',
  },
  TERMO: {
    label: 'Assinatura do termo de autorização', event: 'REPOSITORY_SUBMITTED',
    recipient: 'Todos os alunos e orientador · e-mails do TCC',
    source: 'Dados do processo → Autores e orientador → E-mail',
  },
  DECLARACAO: {
    label: 'Assinatura da declaração · finalização', event: 'PUBLICATION_CLEARED',
    recipient: 'Presidência · e-mail das configurações',
    source: 'Rodapé e Identidade → E-mail da Presidência / recuperação do Master',
  },
} as const;

export function signatureWorkflowBinding(template?: { type?: unknown; id?: unknown }) {
  if (!template) return undefined;
  const type = String(template.type || '').toUpperCase();
  const id = String(template.id || '').toUpperCase();
  const key = (Object.keys(signatureWorkflowBindings) as Array<keyof typeof signatureWorkflowBindings>)
    .find(candidate => type === candidate || id.includes(candidate));
  return key ? signatureWorkflowBindings[key] : undefined;
}
