import { portalNotice } from '../services/portalDialogs';
import React, { useState } from 'react';
import { ProcessDocument, DocumentVersion } from '../types';
import { X, Download, AlertCircle, FileText, CheckCircle2, ShieldCheck, MessageSquarePlus, HardDrive, ExternalLink } from 'lucide-react';
import { CorrectionRequestModal } from './CorrectionRequestModal';
import { useAuth } from '../context/AuthContext';
import { resolveInstallationProfile } from '../utils/installationProfile';

interface DocumentPreviewModalProps {
  document: ProcessDocument | null;
  processProtocol: string;
  onClose: () => void;
  onRequestCorrection: (doc: ProcessDocument) => void;
}

export const DocumentPreviewModal: React.FC<DocumentPreviewModalProps> = ({
  document,
  processProtocol,
  onClose,
  onRequestCorrection
}) => {
  const { settings } = useAuth();
  const profile = resolveInstallationProfile(settings);
  if (!document) return null;

  const currentVer: DocumentVersion | undefined = document.versions?.find((v) => v.isCurrent) || document.versions?.[0];
  const isDownloadable = document.status === 'DISPONIVEL' || document.status === 'ASSINADO';

  const driveUrl = document.driveWebViewLink || currentVer?.driveWebViewLink;
  const driveDownloadUrl = document.driveDownloadUrl || currentVer?.driveDownloadUrl;

  const handleDownload = () => {
    if (!isDownloadable) {
      portalNotice('Este documento ainda não está liberado para download final.');
      return;
    }

    if (driveDownloadUrl) {
      window.open(driveDownloadUrl, '_blank');
      return;
    }

    portalNotice('O PDF ainda não foi arquivado no Google Drive. Aguarde a conclusão da etapa correspondente.');
  };

  return (
    <div id="document-preview-modal-backdrop" className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div id="document-preview-modal" className="portal-modal-surface portal-modal-document bg-white rounded-xl shadow-2xl max-w-3xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Modal Header */}
        <div className="portal-modal-header bg-slate-900 text-white p-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-800 rounded-lg text-emerald-200">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                {processProtocol} • Visualização de Documento
              </div>
              <h2 className="text-base font-bold text-white truncate max-w-md">
                {document.title}
              </h2>
            </div>
          </div>
          <button
            id="close-document-preview-btn"
            onClick={onClose}
            aria-label="Fechar visualização do documento"
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Document Status Banner */}
        <div className="bg-slate-100 px-6 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs font-medium">
          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-semibold">Versão Atual:</span>
            <span className="bg-slate-200 px-2 py-0.5 rounded font-bold text-slate-800">
              v{document.currentVersion}
            </span>
            <span className="text-slate-400">|</span>
            <span className="text-slate-500 font-semibold">Revisão de Dados:</span>
            <span className="text-slate-700">{currentVer?.sourceDataRevision || 1}</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-500">Status:</span>
            <span
              className={`px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                document.status === 'DISPONIVEL' || document.status === 'ASSINADO'
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : document.status === 'AGUARDANDO_ASSINATURA'
                  ? 'bg-amber-100 text-amber-900 border border-amber-300'
                  : 'bg-slate-200 text-slate-700'
              }`}
            >
              {document.status}
            </span>
          </div>
        </div>

        {/* Document Body / Simulated PDF View */}
        <div id="simulated-pdf-container" className="p-6 flex-1 overflow-y-auto bg-slate-50 font-serif leading-relaxed text-slate-800 text-sm border-b border-slate-200 shadow-inner min-h-[250px]">
          <div className="max-w-xl mx-auto bg-white p-8 border border-slate-200 shadow-sm rounded-sm my-2 space-y-4">
            <div className="text-center pb-4 border-b border-slate-200">
              <div className="font-sans font-bold text-xs uppercase text-slate-600 tracking-wider">
                {profile.institutionName}
              </div>
              <div className="font-sans font-semibold text-xs text-slate-500">
                {profile.departmentName} • {profile.courseName}
              </div>
              <div className="font-sans font-bold text-slate-900 text-sm mt-2">
                {document.title}
              </div>
            </div>

            <div className="whitespace-pre-wrap font-serif text-slate-900 text-sm leading-relaxed">
              {currentVer?.contentPreviewText || 'Conteúdo em geração...'}
            </div>

            {/* Signature Guidance according to Institutional Rules */}
            {document.type === 'CONVITE' && (
              <div className="mt-6 p-3 bg-slate-100 border border-slate-200 rounded-lg text-slate-700 text-xs font-sans flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                <div>
                  <strong>Documento Informativo (Sem Assinatura):</strong> O convite de defesa não exige assinatura. É utilizado como anexo no e-mail aos membros da banca.
                </div>
              </div>
            )}

            {document.type === 'DECLARACAO' && (
              <div className="mt-6 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-900 text-xs font-sans flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <strong>Assinatura pela Asten:</strong> a declaração de participação é assinada digitalmente pelo Presidente da Comissão.
                </div>
              </div>
            )}

            {document.type === 'ATA' && (
              <div className="mt-6 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-xs font-sans flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <strong>Assinatura pela Asten:</strong> ao clicar em “Assinar documento”, a ata é enviada ao orientador e, depois de concluída, arquivada automaticamente no Google Drive.
                </div>
              </div>
            )}

            {document.type === 'TERMO' && (
              <div className="mt-6 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-xs font-sans flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <strong>Assinatura pela Asten:</strong> aluno(s) e orientador recebem o termo simultaneamente, todos com a mesma prioridade, antes da publicação no acervo.
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer Controls */}
        <div className="p-4 bg-white flex flex-wrap items-center justify-between gap-3">
          <button
            id="modal-request-correction-btn"
            onClick={() => onRequestCorrection(document)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors border border-slate-300"
          >
            <MessageSquarePlus className="w-4 h-4 text-amber-600" />
            Solicitar Ajuste / Correção
          </button>

          <div className="flex items-center gap-2">
            {driveUrl && (
              <a
                href={driveUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg transition-colors"
                title="Abrir diretamente no Google Drive"
              >
                <HardDrive className="w-4 h-4 text-emerald-700" />
                <span>Abrir no Google Drive</span>
                <ExternalLink className="w-3.5 h-3.5 text-emerald-600" />
              </a>
            )}

            <button
              id="modal-close-preview-btn"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-300 rounded-lg cursor-pointer"
            >
              Fechar
            </button>

            <button
              id="modal-download-pdf-btn"
              onClick={handleDownload}
              disabled={!isDownloadable}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg shadow-xs transition-colors cursor-pointer ${
                isDownloadable
                  ? 'portal-modal-primary bg-emerald-700 hover:bg-emerald-800 text-white'
                  : 'bg-slate-300 text-slate-500 cursor-not-allowed'
              }`}
            >
              <Download className="w-4 h-4" />
              <span>Baixar Documento</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
