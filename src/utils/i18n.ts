export type PortalLocale = 'pt-BR' | 'en-US' | 'es-ES';

const messages = {
  'pt-BR': {
    formsTitle: 'Formulários do processo', emptyForms: 'Não há formulários pendentes para o seu papel.',
    submit: 'Enviar formulário', submitting: 'Enviando…', required: 'Campo obrigatório',
    select: 'Selecione uma opção', saved: 'Formulário registrado e fluxo atualizado.',
    archived: 'PDF arquivado no Google Drive', archivePending: 'Registro salvo; o arquivamento no Drive exige nova tentativa.',
    revision: 'Versão', history: 'Envios anteriores', fileLink: 'Cole o link seguro do arquivo no Google Drive'
  },
  'en-US': {
    formsTitle: 'Process forms', emptyForms: 'There are no pending forms for your role.',
    submit: 'Submit form', submitting: 'Submitting…', required: 'Required field',
    select: 'Select an option', saved: 'Form saved and workflow updated.',
    archived: 'PDF archived in Google Drive', archivePending: 'Saved; Drive archiving requires another attempt.',
    revision: 'Version', history: 'Previous submissions', fileLink: 'Paste the secure Google Drive file link'
  },
  'es-ES': {
    formsTitle: 'Formularios del proceso', emptyForms: 'No hay formularios pendientes para su perfil.',
    submit: 'Enviar formulario', submitting: 'Enviando…', required: 'Campo obligatorio',
    select: 'Seleccione una opción', saved: 'Formulario guardado y flujo actualizado.',
    archived: 'PDF archivado en Google Drive', archivePending: 'Guardado; el archivo en Drive requiere otro intento.',
    revision: 'Versión', history: 'Envíos anteriores', fileLink: 'Pegue el enlace seguro del archivo en Google Drive'
  }
} as const;

export function getPortalMessages(locale?: string) {
  return messages[(locale && locale in messages ? locale : 'pt-BR') as PortalLocale];
}
