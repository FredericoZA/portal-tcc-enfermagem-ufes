import React from 'react';
import {
  Layers,
  FileCheck,
  Calendar,
  Plus,
  Lock,
  Eye,
  CheckCircle,
  HelpCircle,
  FileText,
  Clock,
  MapPin,
  User,
  Users,
  Upload,
  Sparkles,
  Download,
  Printer,
  ZoomIn,
  ZoomOut,
  ShieldCheck,
  Award
} from 'lucide-react';
import { NursingEmblemLogo } from '../NursingEmblemLogo';
import { ColorField, TextField, FontSelectorField } from './EditorFields';
import { TccDetailPopupFormat } from '../../types/tccDetailFormat';
import { GeneralPopupsConfig } from '../UnifiedPortalEditorModal';
import { LoginPopupConfig } from '../../utils/loginPopupConfig';

export interface PopupPreviewSectionProps {
  activeTab:
    | 'global_popup_style'
    | 'popup_tcc_detail'
    | 'popup_new_defense'
    | 'popup_upload_ata'
    | 'popup_hipoar'
    | 'popup_pdf_viewer'
    | 'popup_login'
    | 'popup_correction';
  tccDetailFormat: TccDetailPopupFormat;
  updateTccDetailLive: (updater: (prev: TccDetailPopupFormat) => TccDetailPopupFormat) => void;
  generalPopupsConfig: GeneralPopupsConfig;
  updateGeneralPopupsLive: (updater: (prev: GeneralPopupsConfig) => GeneralPopupsConfig) => void;
  loginPopupConfig: LoginPopupConfig;
  updateLoginPopupLive: (updater: (prev: LoginPopupConfig) => LoginPopupConfig) => void;
  buttonRadiusClass?: string;
}

export const PopupPreviewSection: React.FC<PopupPreviewSectionProps> = ({
  activeTab,
  tccDetailFormat,
  updateTccDetailLive,
  generalPopupsConfig,
  updateGeneralPopupsLive,
  loginPopupConfig,
  updateLoginPopupLive,
  buttonRadiusClass = 'rounded-lg'
}) => {
  // 1. TCC DETAIL POPUP PREVIEW & CONTROLS
  if (activeTab === 'popup_tcc_detail') {
    const headerBg = tccDetailFormat.headerBgColor || '#005830';
    const actionBg = tccDetailFormat.primaryActionColor || '#005830';

    return (
      <div className="space-y-4">
        {/* REALISTIC LIVE PREVIEW */}
        <div className="w-full bg-white border border-slate-300 rounded-xl shadow-xs overflow-hidden">
          <div className="bg-slate-100 px-3.5 py-2 border-b border-slate-200 flex items-center justify-between">
            <span className="text-[11px] font-black uppercase text-slate-800 flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5 text-slate-700" />
              <span>Preview Ao Vivo: Pop-up de Detalhes da Defesa de TCC</span>
            </span>
            <span className="text-[10px] font-bold text-slate-500">
              Exibido ao clicar em qualquer linha da planilha de defesas
            </span>
          </div>

          <div className="p-4 bg-slate-100/70 flex justify-center">
            <div className="w-full max-w-xl bg-white border border-slate-300 rounded-2xl shadow-xl overflow-hidden">
              {/* Modal Header */}
              <div
                className="p-4 text-white flex items-center justify-between shadow-xs"
                style={{ backgroundColor: headerBg }}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/15 rounded-lg">
                    <Calendar className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-emerald-200 block">
                      Defesa de Trabalho de Conclusão de Curso
                    </span>
                    <h3 className="font-black text-sm uppercase tracking-tight">
                      Detalhes da Banca Examinadora
                    </h3>
                  </div>
                </div>
                <span className="text-xs bg-white/20 px-2.5 py-1 rounded-full font-bold uppercase">
                  Confirmada
                </span>
              </div>

              {/* Modal Content */}
              <div className="p-4 space-y-3.5 text-xs text-slate-800">
                {/* Title and student card */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                  <span className="text-[10px] font-extrabold uppercase text-slate-500">Título do Trabalho</span>
                  <p className="font-bold text-slate-900 leading-snug">
                    Título de exemplo do Trabalho de Conclusão de Curso
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl space-y-0.5">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Discente / Autor(a)</span>
                    <div className="font-extrabold text-slate-900">Ana Clara Mendes da Silva</div>
                    <div className="text-[10px] text-slate-500">Matrícula: 2021104829</div>
                  </div>
                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl space-y-0.5">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Orientador(a)</span>
                    <div className="font-extrabold text-slate-900">Prof.ª Drª. Beatriz Santos Costa</div>
                    <div className="text-[10px] text-slate-500">Presidente da Banca</div>
                  </div>
                </div>

                {/* Date & Location */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-emerald-700 shrink-0" />
                    <div>
                      <div className="text-[10px] font-bold text-slate-500 uppercase">Data & Horário</div>
                      <div className="font-extrabold text-slate-900">28/11/2026 às 14:00</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-emerald-700 shrink-0" />
                    <div>
                      <div className="text-[10px] font-bold text-slate-500 uppercase">Local da Defesa</div>
                      <div className="font-extrabold text-slate-900">Local de defesa configurado</div>
                    </div>
                  </div>
                </div>

                {/* Committee members */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Membros Examinadores da Banca</span>
                  <div className="text-[11px] font-medium text-slate-700 space-y-0.5">
                    <div>• Prof. Dr. Membro Interno (Instituição configurada)</div>
                    <div>• Prof.ª Drª. Juliana Fernandes Rocha (Membro Externo)</div>
                  </div>
                </div>

                {/* Actions */}
                <div className="pt-2 flex flex-col sm:flex-row items-center gap-2">
                  <button
                    type="button"
                    className={`w-full py-2.5 text-xs font-black uppercase text-white shadow-2xs transition-all flex items-center justify-center gap-2 ${buttonRadiusClass}`}
                    style={{ backgroundColor: actionBg }}
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>Confirmar Presença na Banca</span>
                  </button>
                  <button
                    type="button"
                    className={`w-full sm:w-auto px-4 py-2.5 text-xs font-bold text-slate-700 bg-slate-100 border border-slate-300 ${buttonRadiusClass}`}
                  >
                    Google Agenda
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* CONTROLS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wide text-slate-900 border-b border-slate-200 pb-2">
              CORES DO POP-UP DE DETALHES
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <ColorField
                label="Fundo do Cabeçalho"
                value={tccDetailFormat.headerBgColor || '#005830'}
                onChange={(val) => updateTccDetailLive((prev) => ({ ...prev, headerBgColor: val }))}
              />
              <ColorField
                label="Texto do Cabeçalho"
                value={tccDetailFormat.headerTextColor || '#ffffff'}
                onChange={(val) => updateTccDetailLive((prev) => ({ ...prev, headerTextColor: val }))}
              />
              <ColorField
                label="Fundo do Botão de Ação"
                value={tccDetailFormat.primaryActionColor || '#005830'}
                onChange={(val) => updateTccDetailLive((prev) => ({ ...prev, primaryActionColor: val }))}
              />
              <ColorField
                label="Texto do Botão de Ação"
                value={tccDetailFormat.primaryActionTextColor || '#ffffff'}
                onChange={(val) => updateTccDetailLive((prev) => ({ ...prev, primaryActionTextColor: val }))}
              />
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wide text-slate-900 border-b border-slate-200 pb-2">
              OPÇÕES DE EXIBIÇÃO
            </h3>
            <div className="space-y-2 text-xs text-slate-700">
              <label className="flex items-center gap-2 p-2 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer">
                <input
                  type="checkbox"
                  checked={tccDetailFormat.showAttendanceButton !== false}
                  onChange={(e) => updateTccDetailLive((prev) => ({ ...prev, showAttendanceButton: e.target.checked }))}
                  className="rounded text-emerald-700"
                />
                <span className="font-bold">Exibir botão "Confirmar Presença"</span>
              </label>
              <label className="flex items-center gap-2 p-2 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer">
                <input
                  type="checkbox"
                  checked={tccDetailFormat.showCalendarButton !== false}
                  onChange={(e) => updateTccDetailLive((prev) => ({ ...prev, showCalendarButton: e.target.checked }))}
                  className="rounded text-emerald-700"
                />
                <span className="font-bold">Exibir botão "Adicionar ao Google Agenda"</span>
              </label>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 2. NEW DEFENSE POPUP PREVIEW & CONTROLS
  if (activeTab === 'popup_new_defense') {
    const headerBg = generalPopupsConfig.newDefenseHeaderBg || '#005830';
    const btnBg = generalPopupsConfig.newDefenseBtnBg || '#005830';

    return (
      <div className="space-y-4">
        {/* REALISTIC LIVE PREVIEW */}
        <div className="w-full bg-white border border-slate-300 rounded-xl shadow-xs overflow-hidden">
          <div className="bg-slate-100 px-3.5 py-2 border-b border-slate-200 flex items-center justify-between">
            <span className="text-[11px] font-black uppercase text-slate-800 flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5 text-slate-700" />
              <span>Preview Ao Vivo: Pop-up de Agendamento de Nova Defesa</span>
            </span>
            <span className="text-[10px] font-bold text-slate-500">
              Formulário oficial de submissão de banca de TCC
            </span>
          </div>

          <div className="p-4 bg-slate-100/70 flex justify-center">
            <div className="w-full max-w-xl border border-slate-300 rounded-2xl shadow-xl overflow-hidden" style={{ backgroundColor: generalPopupsConfig.newDefenseBg || '#ffffff' }}>
              <div
                className="p-4 flex items-center justify-between"
                style={{ backgroundColor: headerBg, color: generalPopupsConfig.newDefenseHeaderTextColor || '#ffffff' }}
              >
                <div className="flex items-center gap-2.5">
                  <Plus className="w-5 h-5 text-white" />
                  <div>
                    <h3 className="font-black text-sm uppercase">{generalPopupsConfig.newDefenseTitle || 'Agendar Defesa de TCC'}</h3>
                    <p className="text-[10px] opacity-90">{generalPopupsConfig.newDefenseSubtitle || 'Cadastro formal da banca examinadora'}</p>
                  </div>
                </div>
              </div>

              <div className="p-4 space-y-3 text-xs text-slate-800">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-extrabold uppercase text-slate-600 block mb-1">Nome do Discente</label>
                    <input type="text" readOnly value="Mariana Ribeiro Costa" className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-bold" />
                  </div>
                  <div>
                    <label className="text-[10px] font-extrabold uppercase text-slate-600 block mb-1">Matrícula institucional</label>
                    <input type="text" readOnly value="2022103941" className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-bold" />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-extrabold uppercase text-slate-600 block mb-1">Título do Trabalho de Conclusão</label>
                  <input type="text" readOnly value="Segurança do Paciente na Administração de Medicamentos" className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-bold" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-extrabold uppercase text-slate-600 block mb-1">Data & Horário</label>
                    <input type="text" readOnly value="14/11/2026 às 14:00" className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-bold" />
                  </div>
                  <div>
                    <label className="text-[10px] font-extrabold uppercase text-slate-600 block mb-1">Local / Sala / Link</label>
                    <input type="text" readOnly value="Local de defesa configurado" className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-bold" />
                  </div>
                </div>

                <button
                  type="button"
                  className={`w-full py-2.5 text-xs font-black uppercase shadow-2xs transition-all ${buttonRadiusClass}`}
                  style={{ backgroundColor: btnBg, color: generalPopupsConfig.newDefenseBtnText || '#ffffff' }}
                >
                  Salvar e Agendar Defesa
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* CONTROLS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wide text-slate-900 border-b border-slate-200 pb-2">
              CORES DO AGENDAMENTO
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <ColorField
                label="Fundo do Cabeçalho"
                value={generalPopupsConfig.newDefenseHeaderBg || '#005830'}
                onChange={(val) => updateGeneralPopupsLive((prev) => ({ ...prev, newDefenseHeaderBg: val }))}
              />
              <ColorField
                label="Fundo do Botão"
                value={generalPopupsConfig.newDefenseBtnBg || '#005830'}
                onChange={(val) => updateGeneralPopupsLive((prev) => ({ ...prev, newDefenseBtnBg: val }))}
              />
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wide text-slate-900 border-b border-slate-200 pb-2">
              FONTE DOS POP-UPS
            </h3>
            <FontSelectorField
              label="Tipografia dos Modais"
              value={generalPopupsConfig.fontFamily || 'Inter, sans-serif'}
              onChange={(val) => updateGeneralPopupsLive((prev) => ({ ...prev, fontFamily: val }))}
            />
          </div>
        </div>
      </div>
    );
  }

  // 3. UPLOAD ATA POPUP PREVIEW & CONTROLS
  if (activeTab === 'popup_upload_ata') {
    const headerBg = generalPopupsConfig.uploadAtaHeaderBg || '#005830';
    const btnBg = generalPopupsConfig.uploadAtaBtnBg || '#005830';

    return (
      <div className="space-y-4">
        {/* REALISTIC LIVE PREVIEW */}
        <div className="w-full bg-white border border-slate-300 rounded-xl shadow-xs overflow-hidden">
          <div className="bg-slate-100 px-3.5 py-2 border-b border-slate-200 flex items-center justify-between">
            <span className="text-[11px] font-black uppercase text-slate-800 flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5 text-slate-700" />
              <span>Preview Ao Vivo: Documento Assinado pela Asten</span>
            </span>
            <span className="text-[10px] font-bold text-slate-500">
              Envio e validação da Ata de Defesa com assinatura eletrônica
            </span>
          </div>

          <div className="p-4 bg-slate-100/70 flex justify-center">
            <div className="w-full max-w-xl border border-slate-300 rounded-2xl shadow-xl overflow-hidden" style={{ backgroundColor: generalPopupsConfig.uploadAtaBg || '#ffffff' }}>
              <div
                className="p-4 flex items-center justify-between"
                style={{ backgroundColor: headerBg, color: generalPopupsConfig.uploadAtaHeaderTextColor || '#ffffff' }}
              >
                <div className="flex items-center gap-2.5">
                  <FileCheck className="w-5 h-5 text-white" />
                  <div>
                    <h3 className="font-black text-sm uppercase">{generalPopupsConfig.uploadAtaTitle || 'Documento assinado pela Asten'}</h3>
                    <p className="text-[10px] opacity-90">{generalPopupsConfig.uploadAtaSubtitle || 'Arquivamento automático no Google Drive'}</p>
                  </div>
                </div>
              </div>

              <div className="p-4 space-y-3.5 text-xs text-slate-800">
                {/* Dropzone area */}
                <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center space-y-2 bg-slate-50/50 hover:bg-slate-100/50 transition-all cursor-pointer">
                  <div className="w-10 h-10 bg-emerald-100 text-emerald-800 rounded-full flex items-center justify-center mx-auto">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div className="font-extrabold text-slate-900">Clique para selecionar o PDF da Ata ou arraste o arquivo aqui</div>
                  <div className="text-[10px] text-slate-500 font-medium">PDF assinado pela Asten e arquivado no Drive</div>
                </div>

                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2.5 text-emerald-900">
                  <CheckCircle className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span className="text-[11px] font-bold">
                    O sistema valida automaticamente o carimbo de tempo e as assinaturas eletrônicas dos membros.
                  </span>
                </div>

                <button
                  type="button"
                  className={`w-full py-2.5 text-xs font-black uppercase shadow-2xs transition-all ${buttonRadiusClass}`}
                  style={{ backgroundColor: btnBg, color: generalPopupsConfig.uploadAtaBtnText || '#ffffff' }}
                >
                  Enviar Ata Assinada para Homologação
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* CONTROLS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wide text-slate-900 border-b border-slate-200 pb-2">
              CORES DO UPLOAD DE ATA
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <ColorField
                label="Fundo do Cabeçalho"
                value={generalPopupsConfig.uploadAtaHeaderBg || '#005830'}
                onChange={(val) => updateGeneralPopupsLive((prev) => ({ ...prev, uploadAtaHeaderBg: val }))}
              />
              <ColorField
                label="Fundo do Botão Enviar"
                value={generalPopupsConfig.uploadAtaBtnBg || '#005830'}
                onChange={(val) => updateGeneralPopupsLive((prev) => ({ ...prev, uploadAtaBtnBg: val }))}
              />
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wide text-slate-900 border-b border-slate-200 pb-2">
              INFORMAÇÃO DO COMPONENTE
            </h3>
            <p className="text-xs text-slate-600 font-medium leading-relaxed">
              O módulo de documentos assinados preserva os registros conforme as normas acadêmicas configuradas para a instalação.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // 4. HIPOAR EVALUATION SHEET PREVIEW & CONTROLS
  if (activeTab === 'popup_hipoar') {
    const headerBg = generalPopupsConfig.hipoarHeaderBg || '#0f172a';
    const btnBg = generalPopupsConfig.hipoarAccentColor || '#0284c7';

    return (
      <div className="space-y-4">
        {/* REALISTIC LIVE PREVIEW */}
        <div className="w-full bg-white border border-slate-300 rounded-xl shadow-xs overflow-hidden">
          <div className="bg-slate-100 px-3.5 py-2 border-b border-slate-200 flex items-center justify-between">
            <span className="text-[11px] font-black uppercase text-slate-800 flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5 text-slate-700" />
              <span>Preview Ao Vivo: Ficha Hipoar e Critérios de Avaliação</span>
            </span>
            <span className="text-[10px] font-bold text-slate-500">
              Formulário de notas e pontuação por critério da comissão
            </span>
          </div>

          <div className="p-4 bg-slate-100/70 flex justify-center">
            <div className="w-full max-w-xl border border-slate-300 rounded-2xl shadow-xl overflow-hidden" style={{ backgroundColor: generalPopupsConfig.hipoarBg || '#f8fafc' }}>
              <div
                className="p-4 flex items-center justify-between"
                style={{ backgroundColor: headerBg, color: generalPopupsConfig.hipoarHeaderTextColor || '#ffffff' }}
              >
                <div className="flex items-center gap-2.5">
                  <Award className="w-5 h-5 text-white" />
                  <div>
                    <h3 className="font-black text-sm uppercase">{generalPopupsConfig.hipoarTitle || 'Ficha de Avaliação Hipoar'}</h3>
                    <p className="text-[10px] opacity-90">{generalPopupsConfig.hipoarSubtitle || 'Critérios de pontuação da banca examinadora'}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs bg-white/20 px-2.5 py-1 rounded-full font-black">
                    Nota Final: 9.8
                  </span>
                </div>
              </div>

              <div className="p-4 space-y-3 text-xs text-slate-800">
                <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl overflow-hidden">
                  <div className="p-2.5 bg-slate-50 flex items-center justify-between font-bold">
                    <span>1. Relevância do Tema & Metodologia</span>
                    <span className="text-emerald-700 font-extrabold">3.0 / 3.0</span>
                  </div>
                  <div className="p-2.5 bg-white flex items-center justify-between font-bold">
                    <span>2. Domínio de Conteúdo & Apresentação Oral</span>
                    <span className="text-emerald-700 font-extrabold">3.8 / 4.0</span>
                  </div>
                  <div className="p-2.5 bg-slate-50 flex items-center justify-between font-bold">
                    <span>3. Resposta aos Questionamentos da Banca</span>
                    <span className="text-emerald-700 font-extrabold">3.0 / 3.0</span>
                  </div>
                </div>

                <button
                  type="button"
                  className={`w-full py-2.5 text-xs font-black uppercase text-white shadow-2xs transition-all ${buttonRadiusClass}`}
                  style={{ backgroundColor: btnBg }}
                >
                  Salvar Avaliação da Banca
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* CONTROLS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wide text-slate-900 border-b border-slate-200 pb-2">
              CORES DA FICHA HIPOAR
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <ColorField
                label="Fundo do Cabeçalho"
                value={generalPopupsConfig.hipoarHeaderBg || '#0f172a'}
                onChange={(val) => updateGeneralPopupsLive((prev) => ({ ...prev, hipoarHeaderBg: val }))}
              />
              <ColorField
                label="Fundo do Botão"
                value={generalPopupsConfig.hipoarAccentColor || '#0284c7'}
                onChange={(val) => updateGeneralPopupsLive((prev) => ({ ...prev, hipoarAccentColor: val }))}
              />
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wide text-slate-900 border-b border-slate-200 pb-2">
              DESCRIÇÃO
            </h3>
            <p className="text-xs text-slate-600 font-medium leading-relaxed">
              A ficha de avaliação padroniza a atribuição de notas conforme os critérios definidos pelo curso.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // 5. PDF VIEWER POPUP PREVIEW & CONTROLS
  if (activeTab === 'popup_pdf_viewer') {
    const headerBg = generalPopupsConfig.pdfViewerHeaderBg || '#1e293b';

    return (
      <div className="space-y-4">
        {/* REALISTIC LIVE PREVIEW */}
        <div className="w-full bg-white border border-slate-300 rounded-xl shadow-xs overflow-hidden">
          <div className="bg-slate-100 px-3.5 py-2 border-b border-slate-200 flex items-center justify-between">
            <span className="text-[11px] font-black uppercase text-slate-800 flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5 text-slate-700" />
              <span>Preview Ao Vivo: Visualizador de Documentos PDF</span>
            </span>
            <span className="text-[10px] font-bold text-slate-500">
              Leitor integrado para Atas, TCCs e Fichas Catalográficas
            </span>
          </div>

          <div className="p-4 bg-slate-100/70 flex justify-center">
            <div className="w-full max-w-xl rounded-2xl shadow-xl overflow-hidden border border-slate-700" style={{ backgroundColor: generalPopupsConfig.pdfViewerBg || '#0f172a' }}>
              {/* PDF Toolbar */}
              <div
                className="p-3 flex items-center justify-between text-xs"
                style={{ backgroundColor: headerBg, color: generalPopupsConfig.pdfViewerHeaderTextColor || '#ffffff' }}
              >
                <div className="flex items-center gap-2 font-bold truncate">
                  <FileText className="w-4 h-4 shrink-0" />
                  <span className="truncate">{generalPopupsConfig.pdfViewerTitle || 'Visualização do documento PDF'}</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button className="p-1 bg-white/20 rounded hover:bg-white/30" title="Zoom In"><ZoomIn className="w-3.5 h-3.5" /></button>
                  <button className="p-1 bg-white/20 rounded hover:bg-white/30" title="Zoom Out"><ZoomOut className="w-3.5 h-3.5" /></button>
                  <button className="p-1 bg-white/20 rounded hover:bg-white/30" title="Imprimir"><Printer className="w-3.5 h-3.5" /></button>
                  <button className="p-1 bg-white/20 rounded hover:bg-white/30" title="Download"><Download className="w-3.5 h-3.5" /></button>
                </div>
              </div>

              {/* PDF Page simulation */}
              <div className="p-6 bg-slate-800 flex justify-center">
                <div className="w-full max-w-md bg-white rounded-lg shadow-md p-6 space-y-3 text-[10px] text-slate-800">
                  <div className="text-center font-black uppercase text-[11px] border-b pb-2 text-slate-900">
                    UNIVERSIDADE FEDERAL DO ESPÍRITO SANTO<br />
                    CENTRO DE CIÊNCIAS DA SAÚDE • ENFERMAGEM
                  </div>
                  <div className="text-center font-bold">
                    ATA DA SESSÃO PÚBLICA DE DEFESA DE TCC
                  </div>
                  <div className="text-justify leading-relaxed text-slate-700">
                    Na data registrada, reuniu-se a Banca Examinadora aprovada pelo curso para avaliar o Trabalho de Conclusão de Curso...
                  </div>
                  <div className="pt-4 border-t flex justify-between items-center text-[9px] font-bold text-slate-500">
                    <span>Documento Assinado Eletronicamente</span>
                    <span>Página 1 de 3</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* CONTROLS */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
          <h3 className="text-xs font-black uppercase tracking-wide text-slate-900 border-b border-slate-200 pb-2">
            BARRA DE FERRAMENTAS DO PDF
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <ColorField
              label="Fundo da Barra do Leitor PDF"
              value={generalPopupsConfig.pdfViewerHeaderBg || '#1e293b'}
              onChange={(val) => updateGeneralPopupsLive((prev) => ({ ...prev, pdfViewerHeaderBg: val }))}
            />
          </div>
        </div>
      </div>
    );
  }

  // 6. LOGIN POPUP PREVIEW & CONTROLS
  if (activeTab === 'popup_login') {
    const cardBg = loginPopupConfig.cardBgColor || '#005830';
    const btnBg = loginPopupConfig.primaryBtnBg || '#005830';
    const btnText = loginPopupConfig.primaryBtnTextColor || '#ffffff';

    return (
      <div className="space-y-4">
        {/* REALISTIC LIVE PREVIEW */}
        <div className="w-full bg-white border border-slate-300 rounded-xl shadow-xs overflow-hidden">
          <div className="bg-slate-100 px-3.5 py-2 border-b border-slate-200 flex items-center justify-between">
            <span className="text-[11px] font-black uppercase text-slate-800 flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5 text-slate-700" />
              <span>Prévia ao vivo: modal de acesso restrito</span>
            </span>
            <span className="text-[10px] font-bold text-slate-500">
              Autenticação para docentes, discentes e membros da comissão
            </span>
          </div>

          <div className="p-4 bg-slate-100/70 flex justify-center">
            <div className="w-full max-w-sm bg-white border border-slate-300 rounded-2xl shadow-xl overflow-hidden text-center">
              <div
                className="p-6 text-white flex flex-col items-center space-y-2"
                style={{ backgroundColor: cardBg }}
              >
                <NursingEmblemLogo size={52} className="text-white" />
                <h3 className="font-black text-sm uppercase tracking-tight text-white">
                  {loginPopupConfig.title || 'Portal de TCC • Instituição configurada'}
                </h3>
                <p className="text-[10.5px] opacity-90">
                  {loginPopupConfig.subtitle || 'Acesso por código enviado ao e-mail cadastrado'}
                </p>
              </div>

              <div className="p-4 space-y-3 text-xs text-left">
                <div>
                  <label className="text-[10px] font-extrabold uppercase text-slate-600 block mb-1">E-mail institucional ou cadastrado</label>
                  <input type="email" readOnly placeholder="nome@ufes.br" className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-bold" />
                </div>
                <div>
                  <label className="text-[10px] font-extrabold uppercase text-slate-600 block mb-1">Código de confirmação</label>
                  <input type="text" readOnly placeholder="000000" className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-bold tracking-[0.25em]" />
                </div>

                <button
                  type="button"
                  className={`w-full py-2.5 text-xs font-black uppercase shadow-2xs transition-all mt-2 ${buttonRadiusClass}`}
                  style={{ backgroundColor: btnBg, color: btnText }}
                >
                  {loginPopupConfig.buttonText || 'Confirmar código'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* CONTROLS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wide text-slate-900 border-b border-slate-200 pb-2">
              CORES DO LOGIN
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <ColorField
                label="Fundo do Card de Login"
                value={loginPopupConfig.cardBgColor || '#005830'}
                onChange={(val) => updateLoginPopupLive((prev) => ({ ...prev, cardBgColor: val }))}
              />
              <ColorField
                label="Fundo do Botão Entrar"
                value={loginPopupConfig.primaryBtnBg || '#005830'}
                onChange={(val) => updateLoginPopupLive((prev) => ({ ...prev, primaryBtnBg: val }))}
              />
              <ColorField
                label="Texto do Botão Entrar"
                value={loginPopupConfig.primaryBtnTextColor || '#ffffff'}
                onChange={(val) => updateLoginPopupLive((prev) => ({ ...prev, primaryBtnTextColor: val }))}
              />
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wide text-slate-900 border-b border-slate-200 pb-2">
              TEXTOS DO LOGIN
            </h3>
            <div className="space-y-3">
              <TextField
                label="Título do Modal"
                value={loginPopupConfig.title || 'Portal de TCC • Instituição configurada'}
                onChange={(val) => updateLoginPopupLive((prev) => ({ ...prev, title: val }))}
              />
              <TextField
                label="Subtítulo de Instrução"
                value={loginPopupConfig.subtitle || 'Acesso por código enviado ao e-mail cadastrado'}
                onChange={(val) => updateLoginPopupLive((prev) => ({ ...prev, subtitle: val }))}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 7. CORRECTION & LISTENER CERTIFICATE POPUP PREVIEW & CONTROLS
  if (activeTab === 'popup_correction') {
    const headerBg = generalPopupsConfig.correctionHeaderBg || '#005830';
    const btnBg = generalPopupsConfig.correctionBtnBg || '#005830';

    return (
      <div className="space-y-4">
        {/* REALISTIC LIVE PREVIEW */}
        <div className="w-full bg-white border border-slate-300 rounded-xl shadow-xs overflow-hidden">
          <div className="bg-slate-100 px-3.5 py-2 border-b border-slate-200 flex items-center justify-between">
            <span className="text-[11px] font-black uppercase text-slate-800 flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5 text-slate-700" />
              <span>Preview Ao Vivo: Certidão de Ouvinte & Correções</span>
            </span>
            <span className="text-[10px] font-bold text-slate-500">
              Solicitação e emissão de certificados de participação em bancas
            </span>
          </div>

          <div className="p-4 bg-slate-100/70 flex justify-center">
            <div className="w-full max-w-xl border border-slate-300 rounded-2xl shadow-xl overflow-hidden" style={{ backgroundColor: generalPopupsConfig.correctionBg || '#ffffff' }}>
              <div
                className="p-4 flex items-center justify-between"
                style={{ backgroundColor: headerBg, color: generalPopupsConfig.correctionHeaderTextColor || '#ffffff' }}
              >
                <div className="flex items-center gap-2.5">
                  <Award className="w-5 h-5 text-white" />
                  <div>
                    <h3 className="font-black text-sm uppercase">{generalPopupsConfig.correctionTitle || 'Solicitação de correção'}</h3>
                    <p className="text-[10px] opacity-90">{generalPopupsConfig.correctionSubtitle || 'Descreva o ajuste necessário no documento'}</p>
                  </div>
                </div>
              </div>

              <div className="p-4 space-y-3 text-xs text-slate-800">
                <div>
                  <label className="text-[10px] font-extrabold uppercase text-slate-600 block mb-1">Nome Completo do Ouvinte</label>
                  <input type="text" readOnly value="Lucas de Oliveira Santos" className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-bold" />
                </div>
                <div>
                  <label className="text-[10px] font-extrabold uppercase text-slate-600 block mb-1">Defesa Assistida</label>
                  <input type="text" readOnly value="Trabalho acadêmico de exemplo (28/11/2026)" className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-bold" />
                </div>

                <button
                  type="button"
                  className={`w-full py-2.5 text-xs font-black uppercase text-white shadow-2xs transition-all ${buttonRadiusClass}`}
                  style={{ backgroundColor: btnBg }}
                >
                  Gerar Certificado em PDF
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* CONTROLS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wide text-slate-900 border-b border-slate-200 pb-2">
              CORES DO CERTIFICADO
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <ColorField
                label="Fundo do Cabeçalho"
                value={generalPopupsConfig.correctionHeaderBg || '#005830'}
                onChange={(val) => updateGeneralPopupsLive((prev) => ({ ...prev, correctionHeaderBg: val }))}
              />
              <ColorField
                label="Fundo do Botão Gerar"
                value={generalPopupsConfig.correctionBtnBg || '#005830'}
                onChange={(val) => updateGeneralPopupsLive((prev) => ({ ...prev, correctionBtnBg: val }))}
              />
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wide text-slate-900 border-b border-slate-200 pb-2">
              UTILIDADE
            </h3>
            <p className="text-xs text-slate-600 font-medium leading-relaxed">
              Emite certificados válidos com código de autenticidade para alunos que assistiram às bancas públicas de TCC.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // 8. GLOBAL POPUP STYLE (FALLBACK / BASE PRESET)
  return (
    <div className="space-y-4">
      <div className="w-full bg-white border border-slate-300 rounded-xl shadow-xs overflow-hidden">
        <div className="bg-slate-100 px-3.5 py-2 border-b border-slate-200 flex items-center justify-between">
          <span className="text-[11px] font-black uppercase text-slate-800 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-slate-700" />
            <span>Estilo Global de Pop-ups e Modais</span>
          </span>
          <span className="text-[10px] font-bold text-slate-500">
            Define a aparência base compartilhada por todos os modais
          </span>
        </div>

        <div className="p-4 bg-slate-100/70">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-white border border-slate-300 rounded-xl overflow-hidden shadow-xs">
              <div
                className="p-3 text-white font-black text-xs uppercase"
                style={{ backgroundColor: tccDetailFormat.headerBgColor || '#005830' }}
              >
                🎓 Detalhes da Banca
              </div>
              <div className="p-3 text-xs space-y-2">
                <p className="text-slate-600 font-medium">Informações da defesa e membros examinadores.</p>
                <button
                  type="button"
                  className={`w-full py-1 text-[10.5px] font-black text-white ${buttonRadiusClass}`}
                  style={{ backgroundColor: tccDetailFormat.primaryActionColor || '#005830' }}
                >
                  Ação Principal
                </button>
              </div>
            </div>

            <div className="bg-white border border-slate-300 rounded-xl overflow-hidden shadow-xs">
              <div
                className="p-3 text-white font-black text-xs uppercase"
                style={{ backgroundColor: generalPopupsConfig.uploadAtaHeaderBg || '#005830' }}
              >
                📄 Ata Assinada
              </div>
              <div className="p-3 text-xs space-y-2">
                <p className="text-slate-600 font-medium">Validação da assinatura Asten e arquivamento no Drive.</p>
                <button
                  type="button"
                  className={`w-full py-1 text-[10.5px] font-black text-white ${buttonRadiusClass}`}
                  style={{ backgroundColor: generalPopupsConfig.uploadAtaBtnBg || '#005830' }}
                >
                  Baixar Documento
                </button>
              </div>
            </div>

            <div className="bg-white border border-slate-300 rounded-xl overflow-hidden shadow-xs">
              <div
                className="p-3 text-white font-black text-xs uppercase"
                style={{ backgroundColor: loginPopupConfig.cardBgColor || '#005830' }}
              >
                🔐 Acesso ao Portal
              </div>
              <div className="p-3 text-xs space-y-2">
                <p className="text-slate-600 font-medium">Identificação de alunos e docentes.</p>
                <button
                  type="button"
                  className={`w-full py-1 text-[10.5px] font-black text-white ${buttonRadiusClass}`}
                  style={{ backgroundColor: loginPopupConfig.primaryBtnBg || '#005830' }}
                >
                  Entrar no Sistema
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
          <h3 className="text-xs font-black uppercase tracking-wide text-slate-900 border-b border-slate-200 pb-2">
            CORES GLOBAIS DE MODAIS
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <ColorField
              label="Cabeçalho dos Pop-ups"
              value={tccDetailFormat.headerBgColor || '#005830'}
              onChange={(val) => {
                updateTccDetailLive((p) => ({ ...p, headerBgColor: val }));
                updateGeneralPopupsLive((p) => ({ ...p, uploadAtaHeaderBg: val }));
                updateLoginPopupLive((p) => ({ ...p, cardBgColor: val }));
              }}
            />
            <ColorField
              label="Botões de Ação dos Pop-ups"
              value={tccDetailFormat.primaryActionColor || '#005830'}
              onChange={(val) => {
                updateTccDetailLive((p) => ({ ...p, primaryActionColor: val }));
                updateGeneralPopupsLive((p) => ({ ...p, uploadAtaBtnBg: val }));
                updateLoginPopupLive((p) => ({ ...p, primaryBtnBg: val }));
              }}
            />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
          <h3 className="text-xs font-black uppercase tracking-wide text-slate-900 border-b border-slate-200 pb-2">
            TIPOGRAFIA DOS POP-UPS
          </h3>
          <FontSelectorField
            label="Fonte dos Modais"
            value={generalPopupsConfig.fontFamily || 'Inter, sans-serif'}
            onChange={(val) => updateGeneralPopupsLive((prev) => ({ ...prev, fontFamily: val }))}
          />
        </div>
      </div>
    </div>
  );
};
