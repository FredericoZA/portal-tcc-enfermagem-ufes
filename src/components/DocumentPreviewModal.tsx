import { portalNotice } from '../services/portalDialogs';
import React from 'react';
import { ProcessDocument, DocumentVersion } from '../types';
import { Download, AlertCircle, FileText, CheckCircle2, ShieldCheck, MessageSquarePlus, HardDrive, ExternalLink } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { resolveInstallationProfile } from '../utils/installationProfile';
import { PortalModalShell } from './PortalModalShell';
const DocumentFilePreview=React.lazy(()=>import('./DocumentFilePreview').then(module=>({default:module.DocumentFilePreview})));

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

  const previewTitle = `${({CONVITE:'Convite de banca examinadora',ATA:'Ata oficial da defesa final',TERMO:'Termo de autorização para publicação',DECLARACAO:'Declaração de participação na banca'})[document.type]} · ${processProtocol}`;

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
    <PortalModalShell
      open={Boolean(document)}
      onClose={onClose}
      title={previewTitle}
      icon={FileText}
      maxWidthClass="max-w-3xl"
      heightClass="max-h-[90vh]"
      bodyClassName="flex min-h-0 flex-1 flex-col p-3"
    >
      {driveDownloadUrl ? <React.Suspense fallback={<p role="status">Carregando documento…</p>}><DocumentFilePreview url={driveDownloadUrl} format="pdf" label={previewTitle}/></React.Suspense> : <section id="simulated-pdf-container" className="min-h-[250px] flex-1 overflow-y-auto font-serif text-sm leading-relaxed text-slate-800">
        <div className="mx-auto max-w-xl rounded-lg border border-[var(--portal-border)] bg-white p-6 shadow-sm sm:p-8">
          <div className="border-b border-slate-200 pb-4 text-center">
            <div className="font-sans text-xs font-bold normal-case tracking-wider text-slate-600">{profile.institutionName}</div>
            <div className="font-sans text-xs font-semibold text-slate-500">{profile.departmentName} • {profile.courseName}</div>
            <div className="mt-2 font-sans text-sm font-bold text-slate-900">{document.title}</div>
          </div>
          <div className="mt-4 whitespace-pre-wrap font-serif text-sm leading-relaxed text-slate-900">{currentVer?.contentPreviewText || 'Conteúdo em geração...'}</div>

          {document.type === 'CONVITE' && <div className="mt-6 flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 font-sans text-xs text-slate-700"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" /><div><strong>Documento informativo:</strong> o convite de defesa não exige assinatura.</div></div>}
          {document.type === 'DECLARACAO' && <div className="mt-6 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 font-sans text-xs text-emerald-900"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /><div><strong>Assinatura pela Asten:</strong> a declaração é assinada digitalmente pelo Presidente da Comissão.</div></div>}
          {document.type === 'ATA' && <div className="mt-6 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 font-sans text-xs text-amber-900"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" /><div><strong>Assinatura pela Asten:</strong> a ata é enviada ao orientador e, depois de concluída, arquivada automaticamente no Google Drive.</div></div>}
          {document.type === 'TERMO' && <div className="mt-6 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 font-sans text-xs text-amber-900"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" /><div><strong>Assinatura pela Asten:</strong> aluno(s) e orientador recebem o termo antes da publicação no acervo.</div></div>}
        </div>
      </section>}

      <div className="mt-3 flex shrink-0 flex-wrap items-center justify-between gap-2">
        <button id="modal-request-correction-btn" onClick={() => onRequestCorrection(document)} className="portal-action"><MessageSquarePlus className="h-4 w-4 text-amber-700" />Solicitar ajuste / correção</button>
        <div className="flex flex-wrap items-center gap-2">
          {driveUrl && <a href={driveUrl} target="_blank" rel="noopener noreferrer" className="portal-action"><HardDrive className="h-4 w-4 text-[var(--portal-brand-action)]" />Abrir no Google Drive<ExternalLink className="h-3.5 w-3.5" /></a>}
          <button id="modal-download-pdf-btn" onClick={handleDownload} disabled={!isDownloadable} className="portal-action portal-action-primary disabled:cursor-not-allowed disabled:opacity-45"><Download className="h-4 w-4" />Baixar documento</button>
        </div>
      </div>
    </PortalModalShell>
  );
};
