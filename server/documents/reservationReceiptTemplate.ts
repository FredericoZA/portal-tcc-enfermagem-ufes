import type {GlobalSettings, ProcessData} from '../../src/types';
import {formatDateWithWeekday, formatDateTimeWithWeekday, formatTime24h} from '../../src/utils/formatters';
import {authorNames} from '../../src/utils/personPresentation';
import {hasReservationReceiptTemplateFields} from '../../src/utils/reservationReceiptTemplateFields';
import {ensurePortalRenderFolder, readReferenceDocumentModelVersion} from '../integrations/googleWorkspace';
import {renderGoogleDriveTemplateToPdf} from '../integrations/googleDocsRenderer';
import {inspectPdfLayout} from '../workflow/documentQuality';
import {createReservationReceiptPdf} from './reservationReceipt';

export interface ReservationReceiptTemplate {
  templateId: string;
  contentSha256: string;
  version: number;
}

export function reservationReceiptTemplate(settings: GlobalSettings): ReservationReceiptTemplate | undefined {
  const model = settings.documentModels?.COMPROVANTES_RESERVA;
  if (!model || !/^[a-zA-Z0-9_-]{10,}$/.test(model.driveFileId)
      || /^(?:local_model_|test_drive_)/.test(model.driveFileId)
      || !model.contentSha256 || !/^[a-f0-9]{64}$/.test(model.contentSha256)
      || !hasReservationReceiptTemplateFields(model.variables)) return;
  return {templateId:model.driveFileId, contentSha256:model.contentSha256, version:model.activeVersion || 1};
}

export function reservationReceiptTemplateValues(process: ProcessData): Record<string, string> {
  const response = process.defesa.departmentResponse;
  if (!response) throw new Error('A decisão da reserva não está registrada.');
  const lines = (response.receiptBody || '').split('\n');
  const value = (label: string) => lines.find(line => line.startsWith(label + ': '))?.slice(label.length + 2);
  const authors = lines.filter(line => line.startsWith('Autor: ')).map(line => line.slice(7));
  return {
    PROTOCOLO: process.protocolo,
    TITULO: value('Título') || process.titulo,
    ALUNOS: authors.join(' e ') || authorNames(process),
    RESERVA_RESULTADO: response.decision === 'CONFIRMED' ? 'Reserva confirmada' : 'Reserva recusada',
    DEFESA_LOCAL: response.local || value('Local') || process.defesa.local,
    DEFESA_DATA: formatDateWithWeekday(response.startAt),
    DEFESA_HORARIO: `${formatTime24h(response.startAt)} às ${formatTime24h(response.endAt)}`,
    RESPOSTA_REGISTRADA_EM: formatDateTimeWithWeekday(response.respondedAt),
    RESPONSAVEL_RESERVA: response.respondedBy,
  };
}

const googleReceiptPorts = {
  read: readReferenceDocumentModelVersion,
  folder: ensurePortalRenderFolder,
  render: renderGoogleDriveTemplateToPdf,
  inspect: inspectPdfLayout,
};

/** Render only an immutable published version, using facts from the answered reservation. */
export async function renderReservationReceiptTemplate(
  process: ProcessData, model: ReservationReceiptTemplate, accessToken: string, rootFolderId: string,
  ports = googleReceiptPorts,
): Promise<Buffer> {
  const replacements = reservationReceiptTemplateValues(process);
  const verifiedDocxBytes = await ports.read({type:'COMPROVANTES_RESERVA',rootFolderId,fileId:model.templateId,contentSha256:model.contentSha256,accessToken});
  const rendered = await ports.render({
    accessToken, templateUrlOrId:model.templateId, verifiedDocxBytes, replacements, reservationReceiptLayout:true,
    temporaryParentId:await ports.folder(accessToken,rootFolderId),
    outputName:`${process.protocolo}-comprovante.pdf`,
  });
  const normalized = (text: string) => text.toLocaleLowerCase('pt-BR').replace(/\s+/g,' ').trim();
  const body = normalized(rendered.documentText || '');
  if (rendered.unresolvedMarkers.length || rendered.replacementsChanged < Object.keys(replacements).length
      || Object.values(replacements).some(value => !value.trim() || !body.includes(normalized(value)))) {
    throw new Error('O PDF do modelo não confirmou todas as informações da reserva.');
  }
  if (rendered.pdf.length > 16 * 1024 * 1024) throw new Error('O comprovante do modelo ultrapassa 16 MB.');
  const quality = await ports.inspect(rendered.pdf,{maximumPages:5,needsSignature:false,requiredText:Object.values(replacements)});
  if (!quality.pages || quality.issues.some(issue => issue.severity === 'ERROR' || issue.code === 'TEXT_OUTSIDE_PAGE')) throw new Error('O PDF do modelo não passou na conferência de leitura.');
  return rendered.pdf;
}

export async function renderReservationArchivePdf(
  process: ProcessData, model: ReservationReceiptTemplate, settings: GlobalSettings, accessToken: string, rootFolderId: string,
  render = renderReservationReceiptTemplate,
): Promise<{pdf: Buffer; source:'DOCX'|'CANONICAL'}> {
  try {
    return {pdf:await render(process,model,accessToken,rootFolderId),source:'DOCX'};
  } catch {
    return {pdf:await createReservationReceiptPdf(process,settings),source:'CANONICAL'};
  }
}
