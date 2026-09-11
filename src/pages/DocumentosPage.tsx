import { portalNotice } from '../services/portalDialogs';
import React, { useState, useEffect } from 'react';
import { ProcessDocument, ProcessData } from '../types';
import { apiClient } from '../services/apiClient';
import { FolderDown, FileText, Eye, Download } from 'lucide-react';
import { DocumentPreviewModal } from '../components/DocumentPreviewModal';
import { GoogleDriveExplorer } from '../components/GoogleDriveExplorer';
import { generateOfficialDocumentText } from '../utils/documentTemplateEngine';
import { ColorfulHeaderIcon } from '../components/ColorfulHeaderIcon';
import { useAuth } from '../context/AuthContext';
import { resolveInstallationProfile } from '../utils/installationProfile';

interface DocumentosPageProps {
  onSelectProcess: (processId: string) => void;
}

export const DocumentosPage: React.FC<DocumentosPageProps> = ({ onSelectProcess }) => {
  const { settings } = useAuth();
  const profile = resolveInstallationProfile(settings);
  const [processes, setProcesses] = useState<ProcessData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPreviewDoc, setSelectedPreviewDoc] = useState<ProcessDocument | null>(null);
  const [previewProtocol, setPreviewProtocol] = useState('');

  useEffect(() => {
    apiClient.getProcesses().then((data) => {
      setProcesses(data);
      setIsLoading(false);
    });
  }, []);

  return (
    <div id="documentos-page-container" className="space-y-3.5 max-w-7xl mx-auto py-1.5">
      <div className="bg-[#005830] text-white p-3.5 sm:p-4 rounded-2xl border border-emerald-900/80 shadow-sm space-y-1">
        <div className="text-emerald-200 text-[10px] font-extrabold uppercase tracking-widest leading-none">
          {profile.institutionAcronym} • {profile.departmentName || profile.institutionName}
        </div>
        <div className="flex items-center gap-2 mt-1">
          <ColorfulHeaderIcon type="documents" />
          <h1 className="text-sm sm:text-base font-black text-white uppercase tracking-tight">
            Documentos Oficiais de TCC Disponíveis
          </h1>
        </div>
        <p className="text-[10px] sm:text-[11px] text-emerald-100/95 font-medium leading-normal mt-0.5">
          Acesse Convites, Atas, Termos de Autorização e Declarações da Banca autorizados para o seu perfil.
        </p>
      </div>

      {/* Integração Oficial Google Drive */}
      <GoogleDriveExplorer />


      {isLoading ? (
        <div className="bg-white p-6 text-center text-xs font-semibold text-slate-500 border border-slate-200">
          Carregando documentos...
        </div>
      ) : (
        <div className="space-y-3.5">
          {processes.map((proc) => (
            <div key={proc.id} className="bg-white p-4 border border-slate-200 shadow-2xs space-y-3 border-l-2 border-l-emerald-600">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div>
                  <span className="text-xs font-black bg-slate-900 text-white px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                    {proc.protocolo}
                  </span>
                  <h3 className="font-bold text-slate-900 text-sm uppercase mt-2">{proc.titulo}</h3>
                </div>
                <button
                  onClick={() => onSelectProcess(proc.id)}
                  className="text-xs font-bold text-emerald-700 hover:text-emerald-900 uppercase tracking-wider"
                >
                  Ver Processo Completo &rarr;
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {['CONVITE', 'ATA', 'TERMO', 'DECLARACAO'].map((docType) => {
                  const isAvailable = docType === 'CONVITE' || proc.avaliacao.status === 'CONCLUIDO';
                  return (
                    <div key={docType} className="p-3.5 bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                      <div>
                        <div className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">{docType}</div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                          {isAvailable ? 'Disponível' : 'Aguardando Avaliação'}
                        </div>
                      </div>

                      {isAvailable && (
                        <button
                          onClick={() => {
                            setSelectedPreviewDoc({
                              id: `doc-${docType}`,
                              type: docType as any,
                              title: `${docType} - ${proc.titulo}`,
                              status: 'DISPONIVEL',
                              visibleToRoles: ['STUDENT'],
                              requiresSignature: false,
                              currentVersion: 1,
                              createdAt: proc.createdAt,
                              updatedAt: proc.updatedAt,
                              versions: [
                                {
                                  id: 'v1',
                                  version: 1,
                                  sourceDataRevision: 1,
                                  generatedAt: proc.createdAt,
                                  generatedBy: 'sistema',
                                  isCurrent: true,
                                  contentPreviewText: generateOfficialDocumentText(docType, proc)
                                }
                              ]
                            });
                            setPreviewProtocol(proc.protocolo);
                          }}
                          className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-sm shadow-2xs"
                        >
                          Visualizar
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <DocumentPreviewModal
        document={selectedPreviewDoc}
        processProtocol={previewProtocol}
        onClose={() => setSelectedPreviewDoc(null)}
        onRequestCorrection={() => portalNotice('Para solicitar ajuste, abra o detalhe do processo.')}
      />
    </div>
  );
};
