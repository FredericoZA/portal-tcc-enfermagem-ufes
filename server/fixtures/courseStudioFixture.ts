import type {IntegrationStudioSettings} from '../../src/types/integrationStudio';
import {DEFAULT_COURSE_OPERATIONS_POLICY} from '../../src/utils/courseStudioValidator';
export function courseStudioFixture(): IntegrationStudioSettings {
  return {
    schemaVersion: 3,
    revision: 1,
    savedAt: '2026-09-02T00:00:00.000Z',
    savedBy: 'master@example.edu',
    driveModelosFolderUrl: 'https://drive.google.com/drive/folders/1234567890',
    brandKit: {
      institutionName: 'Universidade', courseName: 'Curso', universityLogoUrl: '', courseLogoUrl: '', emailBannerUrl: '',
      primaryColor: '#005a3c', secondaryColor: '#17324d', accentColor: '#d4a017', textColor: '#172033', fontFamily: 'Arial',
      documentHeaderText: 'Universidade', documentFooterText: 'Curso', emailFooterText: 'Comissão'
    },
    documentDesigns: {}, emailDesigns: {}, formDesigns: {},
    matrixColumns: [{ id: 'PUBLICAR_TRABALHO', name: 'PUBLICAR_TRABALHO', label: 'Publicar' }, { id: 'RESUMO', name: 'RESUMO', label: 'Resumo' }],
    matrixRows: [],
    docTemplates: [
      { id: 'termo', type: 'TERMO', label: 'Termo', driveFileId: 'drive-termo-123456', driveFileUrl: 'https://docs.google.com/document/d/drive-termo-123456/edit', templateContentText: '' },
      { id: 'convite', type: 'CONVITE', label: 'Convite', driveFileId: 'drive-convite-123456', driveFileUrl: 'https://docs.google.com/document/d/drive-convite-123456/edit', templateContentText: '' },
      { id: 'ata', type: 'ATA', label: 'Ata', driveFileId: 'drive-ata-123456', driveFileUrl: 'https://docs.google.com/document/d/drive-ata-123456/edit', templateContentText: '' },
      { id: 'declaracao', type: 'DECLARACAO', label: 'Declaração', driveFileId: 'drive-declaracao-123456', driveFileUrl: 'https://docs.google.com/document/d/drive-declaracao-123456/edit', templateContentText: '' }
    ],
    emailTemplates: [
      { id: 'confirmacao', name: 'Confirmação', recipient: '{{ALUNO_EMAIL}}', subject: 'Recebido', body: 'Olá {{ALUNO_NOME}}' },
      { id: 'convite-email', name: 'Convite', recipient: '{{ORIENTADOR_EMAIL}}', subject: 'Convite', body: 'Segue convite', attachments: ['convite'] }
    ],
    formTemplates: [{ id: 'final', title: 'Dados finais', targetRole: 'Aluno', questions: [
      { id: 'q1', fieldKey: 'PUBLICAR_TRABALHO', label: 'Deseja publicar?', fieldType: 'radio', required: true, options: ['Sim', 'Não'] },
      { id: 'q2', fieldKey: 'RESUMO', label: 'Resumo', fieldType: 'textarea', required: true, visibleWhen: { fieldKey: 'PUBLICAR_TRABALHO', operator: 'EQUALS', value: 'Sim' }, validation: { minLength: 20 } }
    ] }],
    workflowStages: [
      { id: 'convite-stage', stageNumber: 1, title: 'Convite', triggerEvent: 'LOCATION_CONFIRMED', actions: [
        { id: 'convite-doc-action', type: 'doc', refId: 'convite', title: 'Gerar convite' },
        { id: 'convite-email-action', type: 'email', refId: 'convite-email', title: 'Enviar convite' }
      ] },
      { id: 'ata-stage', stageNumber: 2, title: 'Ata', triggerEvent: 'EVALUATION_SUBMITTED', actions: [
        { id: 'ata-doc-action', type: 'doc', refId: 'ata', title: 'Gerar ata' }
      ] },
      { id: 'finalizacao', stageNumber: 3, title: 'Finalização', triggerEvent: 'REPOSITORY_SUBMITTED', actions: [
        { id: 'doc-action', type: 'doc', refId: 'termo', title: 'Gerar termo', condition: { fieldKey: 'PUBLICAR_TRABALHO', operator: 'IS_TRUE' } },
        { id: 'email-action', type: 'email', refId: 'confirmacao', title: 'Confirmar recebimento' },
        { id: 'form-action', type: 'form', refId: 'final', title: 'Solicitar dados' }
      ] },
      { id:'presidente',stageNumber:4,title:'Presidente',triggerEvent:'PUBLICATION_CLEARED',actions:[{ id:'declaracao-doc-action',type:'doc',refId:'declaracao',title:'Gerar declaração' }] }
    ],
    operationsPolicy: DEFAULT_COURSE_OPERATIONS_POLICY,
    publication: { status: 'PUBLISHED', publishedRevision: 1, publishedAt: '2026-09-02T00:00:00.000Z', validationScore: 100 },
    auditTrail: []
  };
}
