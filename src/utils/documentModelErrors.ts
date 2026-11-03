/** Shared generation failures: both signature providers use the same published model. */
export class DocumentModelError extends Error {
  constructor(readonly code:'DOCUMENT_MODEL_REQUIRED'|'DOCUMENT_MODEL_UNPUBLISHED'|'DOCUMENT_MODEL_CONTENT_CHANGED') {
    super({
      DOCUMENT_MODEL_REQUIRED:'O modelo deste documento ainda não foi cadastrado. O Master precisa cadastrá-lo em Configurações → Documentos e Variáveis antes de gerar o PDF.',
      DOCUMENT_MODEL_UNPUBLISHED:'O modelo deste documento ainda não tem uma versão publicada com integridade registrada. O Master precisa revisá-lo e publicá-lo em Configurações → Documentos e Variáveis.',
      DOCUMENT_MODEL_CONTENT_CHANGED:'O conteúdo do modelo não corresponde à versão publicada. O Master precisa revisar e publicar o modelo em Configurações → Documentos e Variáveis. A geração foi interrompida antes do envio à Asten ou do download para Gov.br; o signatário não precisa acessar o Drive.',
    }[code]);
    this.name='DocumentModelError';
  }
}
