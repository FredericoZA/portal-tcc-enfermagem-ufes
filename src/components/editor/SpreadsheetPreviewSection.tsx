import React from 'react';
import {
  Calendar,
  BookOpen,
  FileText,
  Award,
  Plus,
  SlidersHorizontal,
  Columns,
  Download,
  Eye,
  FileCheck,
  CheckCircle,
  Clock,
  User,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Search
} from 'lucide-react';
import { TableTextFormat } from '../TableColumnSelectorPanel';
import { ColorField, TextField } from './EditorFields';

export interface SpreadsheetPreviewSectionProps {
  activeTab: 'sheet_calendar' | 'sheet_repository' | 'sheet_my_tccs' | 'sheet_coordinator';
  tableFormat: TableTextFormat;
  updateTableFormatLive: (key: keyof TableTextFormat, val: any) => void;
  updateTableFormatBatch: (updates: Partial<TableTextFormat>) => void;
}

export const SpreadsheetPreviewSection: React.FC<SpreadsheetPreviewSectionProps> = ({
  activeTab,
  tableFormat,
  updateTableFormatLive,
  updateTableFormatBatch,
}) => {
  const getButtonRadiusClass = () => {
    if (tableFormat.toolbarButtonShape === 'circle') return 'rounded-full';
    if (tableFormat.toolbarButtonShape === 'square') return 'rounded-none';
    return 'rounded-lg';
  };

  const buttonRadiusClass = getButtonRadiusClass();
  const headerBg = tableFormat.customHeaderColor || '#005830';
  const headerText = tableFormat.customHeaderTextColor || '#ffffff';
  const buttonBg = tableFormat.toolbarButtonColor || '#005830';
  const buttonText = tableFormat.toolbarButtonTextColor || '#ffffff';
  const buttonBorder = tableFormat.toolbarButtonBorderColor || '#047857';

  // 1. PUBLIC CALENDAR SHEET
  if (activeTab === 'sheet_calendar') {
    return (
      <div className="space-y-4">
        {/* LIVE REALISTIC PREVIEW */}
        <div className="w-full bg-white border border-slate-300 rounded-xl shadow-xs overflow-hidden">
          <div className="bg-slate-100 px-3.5 py-2 border-b border-slate-200 flex items-center justify-between">
            <span className="text-[11px] font-black uppercase text-slate-800 flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5 text-slate-700" />
              <span>Preview Ao Vivo: Calendário Público de Defesas</span>
            </span>
            <span className="text-[10px] font-bold text-slate-500">
              Reflete exatamente a visualização principal do calendário
            </span>
          </div>

          <div className="p-3.5 bg-slate-100/60 space-y-3">
            {/* Top Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-2 bg-white p-3 rounded-xl border border-slate-200">
              <div>
                <h4 className="text-xs sm:text-sm font-black uppercase text-slate-900 tracking-tight">
                  {tableFormat.tableTitle || 'Calendário de Defesas Públicas de TCC'}
                </h4>
                <p className="text-[10.5px] font-bold text-slate-500">
                  Curso configurado • Período letivo atual
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className={`px-3 py-1.5 text-xs font-black shadow-2xs flex items-center gap-1.5 ${buttonRadiusClass}`}
                  style={{
                    backgroundColor: buttonBg,
                    color: buttonText,
                    border: `1px solid ${buttonBorder}`,
                  }}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{tableFormat.newDefenseButtonText || 'Agendar Defesa'}</span>
                </button>
                <button
                  type="button"
                  className={`px-2.5 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 border border-slate-300 ${buttonRadiusClass}`}
                >
                  {tableFormat.downloadDadosButtonText || 'Exportar Dados'}
                </button>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 bg-white p-2.5 rounded-xl border border-slate-200 text-xs">
              <div className="sm:col-span-2">
                <input
                  type="text"
                  readOnly
                  placeholder="🔍 Buscar aluno, orientador, título..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-md p-1.5 text-xs text-slate-600 font-medium"
                />
              </div>
              <div>
                <select className="w-full bg-slate-50 border border-slate-300 rounded-md p-1.5 text-xs text-slate-700 font-bold" readOnly>
                  <option>Ano: 2026</option>
                </select>
              </div>
              <div>
                <select className="w-full bg-slate-50 border border-slate-300 rounded-md p-1.5 text-xs text-slate-700 font-bold" readOnly>
                  <option>Semestre: 2026/2</option>
                </select>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto rounded-xl border border-slate-300 bg-white">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr
                    className="font-black uppercase text-[10px] tracking-wider"
                    style={{ backgroundColor: headerBg, color: headerText }}
                  >
                    <th className="p-3">Discente & Título</th>
                    <th className="p-3">Orientador(a)</th>
                    <th className="p-3">Data / Hora</th>
                    <th className="p-3">Local</th>
                    <th className="p-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-medium text-[11px] text-slate-800">
                  <tr className="bg-white hover:bg-slate-50">
                    <td className="p-3">
                      <div className="font-bold text-slate-900">Mariana Ribeiro Costa</div>
                      <div className="text-[10px] text-slate-500 font-semibold truncate max-w-[240px]">
                        Segurança do Paciente na Administração de Medicamentos
                      </div>
                    </td>
                    <td className="p-3 font-bold">Prof.ª Drª. Beatriz Costa</td>
                    <td className="p-3 font-bold text-slate-700">14/11/2026 às 14:00</td>
                    <td className="p-3">Auditório Central (Presencial)</td>
                    <td className="p-3 text-center">
                      <span className={`px-2.5 py-0.5 text-[9px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300 ${buttonRadiusClass}`}>
                        CONFIRMADA
                      </span>
                    </td>
                  </tr>
                  <tr className="bg-slate-50/70 hover:bg-slate-100/70">
                    <td className="p-3">
                      <div className="font-bold text-slate-900">Gabriel Almeida Santos</div>
                      <div className="text-[10px] text-slate-500 font-semibold truncate max-w-[240px]">
                        Cuidados Paliativos na Atenção Básica de Saúde
                      </div>
                    </td>
                    <td className="p-3 font-bold">Prof. Dr. Ricardo Silva</td>
                    <td className="p-3 font-bold text-slate-700">18/11/2026 às 09:30</td>
                    <td className="p-3">Sala de Seminários 02</td>
                    <td className="p-3 text-center">
                      <span className={`px-2.5 py-0.5 text-[9px] font-black bg-blue-100 text-blue-800 border border-blue-300 ${buttonRadiusClass}`}>
                        AGENDADA
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* CONTROLS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wide text-slate-900 border-b border-slate-200 pb-2 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-700" />
              <span>Cores do Calendário Público</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <ColorField
                label="Fundo do Cabeçalho da Tabela"
                value={tableFormat.customHeaderColor || '#005830'}
                onChange={(val) => updateTableFormatLive('customHeaderColor', val)}
              />
              <ColorField
                label="Texto do Cabeçalho"
                value={tableFormat.customHeaderTextColor || '#ffffff'}
                onChange={(val) => updateTableFormatLive('customHeaderTextColor', val)}
              />
              <ColorField
                label="Cor dos Botões no Topo"
                value={tableFormat.toolbarButtonColor || '#005830'}
                onChange={(val) => updateTableFormatLive('toolbarButtonColor', val)}
              />
              <ColorField
                label="Texto dos Botões"
                value={tableFormat.toolbarButtonTextColor || '#ffffff'}
                onChange={(val) => updateTableFormatLive('toolbarButtonTextColor', val)}
              />
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wide text-slate-900 border-b border-slate-200 pb-2">
              TÍTULOS E RÓTULOS DO CALENDÁRIO
            </h3>
            <div className="space-y-3">
              <TextField
                label="Título Principal da Tabela"
                value={tableFormat.tableTitle || 'Calendário de Defesas Públicas de TCC'}
                onChange={(val) => updateTableFormatLive('tableTitle', val)}
              />
              <TextField
                label="Texto do Botão Agendar Defesa"
                value={tableFormat.newDefenseButtonText || 'Agendar Defesa'}
                onChange={(val) => updateTableFormatLive('newDefenseButtonText', val)}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 2. REPOSITORY / ACERVO SHEET
  if (activeTab === 'sheet_repository') {
    return (
      <div className="space-y-4">
        {/* LIVE REALISTIC PREVIEW */}
        <div className="w-full bg-white border border-slate-300 rounded-xl shadow-xs overflow-hidden">
          <div className="bg-slate-100 px-3.5 py-2 border-b border-slate-200 flex items-center justify-between">
            <span className="text-[11px] font-black uppercase text-slate-800 flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-slate-700" />
              <span>Preview Ao Vivo: Repositório & Acervo de TCCs Homologados</span>
            </span>
            <span className="text-[10px] font-bold text-slate-500">
              Biblioteca digital com busca, resumo e download de Atas PDF
            </span>
          </div>

          <div className="p-3.5 bg-slate-100/60 space-y-3">
            {/* Search and Filters */}
            <div className="bg-white p-3 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative flex-1 w-full">
                <input
                  type="text"
                  readOnly
                  placeholder="🔍 Pesquisar por tema, autor, orientador, ano ou palavras-chave..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-medium text-slate-700 pl-3"
                />
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <select className="bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-bold text-slate-700" readOnly>
                  <option>Ano: Todos (2020-2026)</option>
                </select>
                <button
                  type="button"
                  className={`px-3 py-2 text-xs font-bold text-white shadow-2xs shrink-0 flex items-center gap-1.5 ${buttonRadiusClass}`}
                  style={{ backgroundColor: buttonBg }}
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Baixar Acervo</span>
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto rounded-xl border border-slate-300 bg-white">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr
                    className="font-black uppercase text-[10px] tracking-wider"
                    style={{ backgroundColor: headerBg, color: headerText }}
                  >
                    <th className="p-3">Ano/Semestre</th>
                    <th className="p-3">Título do Trabalho de Conclusão</th>
                    <th className="p-3">Autor(a)</th>
                    <th className="p-3">Orientador(a)</th>
                    <th className="p-3 text-center">Documento</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-medium text-[11px] text-slate-800">
                  <tr className="bg-white hover:bg-slate-50">
                    <td className="p-3 font-bold text-slate-900">2026/1</td>
                    <td className="p-3">
                      <div className="font-bold text-slate-900">Título de exemplo do Trabalho de Conclusão de Curso</div>
                      <div className="text-[10px] text-slate-500 font-medium">Área: Área de conhecimento • Palavras-chave: Tema, Método, Resultado</div>
                    </td>
                    <td className="p-3 font-bold">Camila Vasconcelos</td>
                    <td className="p-3 font-bold">Prof.ª Drª. Luciana Nascimento</td>
                    <td className="p-3 text-center">
                      <button
                        type="button"
                        className={`px-2.5 py-1 text-[10px] font-black uppercase text-white shadow-2xs flex items-center justify-center gap-1 mx-auto ${buttonRadiusClass}`}
                        style={{ backgroundColor: buttonBg }}
                      >
                        <FileCheck className="w-3 h-3" />
                        <span>Ata PDF</span>
                      </button>
                    </td>
                  </tr>
                  <tr className="bg-slate-50/70 hover:bg-slate-100/70">
                    <td className="p-3 font-bold text-slate-900">2025/2</td>
                    <td className="p-3">
                      <div className="font-bold text-slate-900">Segundo trabalho acadêmico de exemplo</div>
                      <div className="text-[10px] text-slate-500 font-medium">Área: Saúde da Mulher • Palavras-chave: Obstetrícia, Parto Humanizado</div>
                    </td>
                    <td className="p-3 font-bold">Lucas Oliveira Santos</td>
                    <td className="p-3 font-bold">Prof.ª Drª. Márcia Valéria Almeida</td>
                    <td className="p-3 text-center">
                      <button
                        type="button"
                        className={`px-2.5 py-1 text-[10px] font-black uppercase text-white shadow-2xs flex items-center justify-center gap-1 mx-auto ${buttonRadiusClass}`}
                        style={{ backgroundColor: buttonBg }}
                      >
                        <FileCheck className="w-3 h-3" />
                        <span>Ata PDF</span>
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* CONTROLS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wide text-slate-900 border-b border-slate-200 pb-2 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-slate-700" />
              <span>Cores do Repositório</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <ColorField
                label="Fundo do Cabeçalho"
                value={tableFormat.customHeaderColor || '#005830'}
                onChange={(val) => updateTableFormatLive('customHeaderColor', val)}
              />
              <ColorField
                label="Texto do Cabeçalho"
                value={tableFormat.customHeaderTextColor || '#ffffff'}
                onChange={(val) => updateTableFormatLive('customHeaderTextColor', val)}
              />
              <ColorField
                label="Cor do Botão Baixar Ata"
                value={tableFormat.toolbarButtonColor || '#005830'}
                onChange={(val) => updateTableFormatLive('toolbarButtonColor', val)}
              />
              <ColorField
                label="Texto do Botão"
                value={tableFormat.toolbarButtonTextColor || '#ffffff'}
                onChange={(val) => updateTableFormatLive('toolbarButtonTextColor', val)}
              />
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wide text-slate-900 border-b border-slate-200 pb-2">
              TEXTOS E OPÇÕES DO REPOSITÓRIO
            </h3>
            <div className="space-y-3">
              <TextField
                label="Título do Repositório"
                value="Repositório & Acervo de TCCs"
                onChange={() => {}}
              />
              <div className="text-xs text-slate-600 font-medium">
                O repositório exibe os TCCs aprovados e homologados da graduação com download da Ata assinada e ficha catalográfica.
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 3. MY TCCS SHEET (STUDENT / ADVISOR / COMMITTEE PORTAL)
  if (activeTab === 'sheet_my_tccs') {
    return (
      <div className="space-y-4">
        {/* LIVE REALISTIC PREVIEW */}
        <div className="w-full bg-white border border-slate-300 rounded-xl shadow-xs overflow-hidden">
          <div className="bg-slate-100 px-3.5 py-2 border-b border-slate-200 flex items-center justify-between">
            <span className="text-[11px] font-black uppercase text-slate-800 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-slate-700" />
              <span>Preview Ao Vivo: Meus TCCs (Painel do Discente & Orientador)</span>
            </span>
            <span className="text-[10px] font-bold text-slate-500">
              Acompanhamento de etapas, atas e submissão final
            </span>
          </div>

          <div className="p-3.5 bg-slate-100/60 space-y-3">
            {/* Status overview cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                <div className="text-[10px] font-bold text-slate-500 uppercase">Processos Ativos</div>
                <div className="text-lg font-black text-slate-900 mt-0.5">1 Trabalho</div>
              </div>
              <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                <div className="text-[10px] font-bold text-slate-500 uppercase">Etapa do Fluxo</div>
                <div className="text-xs font-black text-emerald-700 mt-1 flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>Defesa Realizada • Ata Pronta</span>
                </div>
              </div>
              <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                <div className="text-[10px] font-bold text-slate-500 uppercase">Minha Função</div>
                <div className="text-xs font-black text-slate-900 mt-1">Discente / Autor(a)</div>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto rounded-xl border border-slate-300 bg-white">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr
                    className="font-black uppercase text-[10px] tracking-wider"
                    style={{ backgroundColor: headerBg, color: headerText }}
                  >
                    <th className="p-3">Protocolo</th>
                    <th className="p-3">Título do Trabalho</th>
                    <th className="p-3">Função</th>
                    <th className="p-3">Etapa Atual</th>
                    <th className="p-3 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-medium text-[11px] text-slate-800">
                  <tr className="bg-white hover:bg-slate-50">
                    <td className="p-3 font-mono font-bold text-slate-900">#2026-TCC-042</td>
                    <td className="p-3">
                      <div className="font-bold text-slate-900">Trabalho vinculado ao usuário conectado</div>
                      <div className="text-[10px] text-slate-500 font-medium">Orientador(a): Prof.ª Drª. Beatriz Costa</div>
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 text-[9.5px] font-bold bg-slate-100 text-slate-800 rounded-md border border-slate-300">
                        Discente
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-1.5 text-emerald-700 font-bold text-[10.5px]">
                        <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>Ata Assinada Asten</span>
                      </div>
                    </td>
                    <td className="p-3 text-center">
                      <button
                        type="button"
                        className={`px-3 py-1 text-[10px] font-black uppercase text-white shadow-2xs flex items-center justify-center gap-1 mx-auto ${buttonRadiusClass}`}
                        style={{ backgroundColor: buttonBg }}
                      >
                        <FileCheck className="w-3 h-3" />
                        <span>Acessar Ata</span>
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* CONTROLS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wide text-slate-900 border-b border-slate-200 pb-2 flex items-center gap-2">
              <FileText className="w-4 h-4 text-slate-700" />
              <span>Cores da Área "Meus TCCs"</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <ColorField
                label="Fundo do Cabeçalho"
                value={tableFormat.customHeaderColor || '#005830'}
                onChange={(val) => updateTableFormatLive('customHeaderColor', val)}
              />
              <ColorField
                label="Texto do Cabeçalho"
                value={tableFormat.customHeaderTextColor || '#ffffff'}
                onChange={(val) => updateTableFormatLive('customHeaderTextColor', val)}
              />
              <ColorField
                label="Cor dos Botões de Ação"
                value={tableFormat.toolbarButtonColor || '#005830'}
                onChange={(val) => updateTableFormatLive('toolbarButtonColor', val)}
              />
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wide text-slate-900 border-b border-slate-200 pb-2">
              DESCRIÇÃO DA ÁREA
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed font-medium">
              Esta visualização permite aos estudantes e orientadores autenticados acompanhar o progresso de suas bancas, visualizar a versão final corrigida e baixar a Ata com as assinaturas digitais.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // 4. COORDINATOR / PRESIDENT SHEET
  return (
    <div className="space-y-4">
      {/* LIVE REALISTIC PREVIEW */}
      <div className="w-full bg-white border border-slate-300 rounded-xl shadow-xs overflow-hidden">
        <div className="bg-slate-100 px-3.5 py-2 border-b border-slate-200 flex items-center justify-between">
          <span className="text-[11px] font-black uppercase text-slate-800 flex items-center gap-1.5">
            <Award className="w-3.5 h-3.5 text-slate-700" />
            <span>Prévia ao vivo: Área do Presidente da Comissão</span>
          </span>
          <span className="text-[10px] font-bold text-slate-500">
            Painel executivo de homologação, análise Hipoar e emissão de portarias
          </span>
        </div>

        <div className="p-3.5 bg-slate-100/60 space-y-3">
          {/* Executive Action Bar */}
          <div className="bg-white p-3 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h4 className="text-xs sm:text-sm font-black uppercase text-slate-900 tracking-tight">
                Gestão da Comissão de TCC • Instituição configurada
              </h4>
              <p className="text-[10.5px] font-bold text-slate-500">
                12 defesas realizadas • 2 pendentes de homologação de Ata
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className={`px-3 py-1.5 text-xs font-black text-white shadow-2xs flex items-center gap-1.5 ${buttonRadiusClass}`}
                style={{ backgroundColor: buttonBg }}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Homologar Selecionadas</span>
              </button>
            </div>
          </div>

          {/* Management Table */}
          <div className="overflow-x-auto rounded-xl border border-slate-300 bg-white">
            <table className="w-full text-xs text-left">
              <thead>
                <tr
                  className="font-black uppercase text-[10px] tracking-wider"
                  style={{ backgroundColor: headerBg, color: headerText }}
                >
                  <th className="p-3">Discente & Orientador</th>
                  <th className="p-3">Banca Examinadora</th>
                  <th className="p-3 text-center">Ficha Hipoar</th>
                  <th className="p-3 text-center">Assinatura Ata</th>
                  <th className="p-3 text-center">Ações do Presidente</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-medium text-[11px] text-slate-800">
                <tr className="bg-white hover:bg-slate-50">
                  <td className="p-3">
                    <div className="font-bold text-slate-900">Ana Clara Mendes</div>
                    <div className="text-[10px] text-slate-500 font-medium">Orientador(a): Prof.ª Drª. Beatriz Costa</div>
                  </td>
                  <td className="p-3 text-[10.5px]">
                    <div>1. Prof.ª Drª. Beatriz Costa (Presidente)</div>
                    <div>2. Prof. Dr. Ricardo Silva (Examinador)</div>
                  </td>
                  <td className="p-3 text-center">
                    <span className="px-2 py-0.5 text-[9px] font-black bg-emerald-100 text-emerald-800 rounded border border-emerald-300">
                      NOTA 9.8 • APROVADO
                    </span>
                  </td>
                  <td className="p-3 text-center">
                    <span className="px-2 py-0.5 text-[9px] font-black bg-emerald-100 text-emerald-800 rounded border border-emerald-300">
                      3/3 ASSINADAS
                    </span>
                  </td>
                  <td className="p-3 text-center">
                    <button
                      type="button"
                      className={`px-3 py-1 text-[10px] font-black uppercase text-white shadow-2xs flex items-center justify-center gap-1 mx-auto ${buttonRadiusClass}`}
                      style={{ backgroundColor: buttonBg }}
                    >
                      <ShieldCheck className="w-3 h-3" />
                      <span>Homologar</span>
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* CONTROLS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
          <h3 className="text-xs font-black uppercase tracking-wide text-slate-900 border-b border-slate-200 pb-2 flex items-center gap-2">
            <Award className="w-4 h-4 text-slate-700" />
            <span>Cores da Área do Presidente</span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <ColorField
              label="Fundo do Cabeçalho da Tabela"
              value={tableFormat.customHeaderColor || '#005830'}
              onChange={(val) => updateTableFormatLive('customHeaderColor', val)}
            />
            <ColorField
              label="Texto do Cabeçalho"
              value={tableFormat.customHeaderTextColor || '#ffffff'}
              onChange={(val) => updateTableFormatLive('customHeaderTextColor', val)}
            />
            <ColorField
              label="Cor do Botão de Homologação"
              value={tableFormat.toolbarButtonColor || '#005830'}
              onChange={(val) => updateTableFormatLive('toolbarButtonColor', val)}
            />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
          <h3 className="text-xs font-black uppercase tracking-wide text-slate-900 border-b border-slate-200 pb-2">
            CONTROLE ADMINISTRATIVO
          </h3>
          <p className="text-xs text-slate-600 leading-relaxed font-medium">
            Permite à presidência da comissão gerenciar a emissão de documentos, acompanhar as assinaturas Asten e homologar formalmente os TCCs para o colegiado do curso.
          </p>
        </div>
      </div>
    </div>
  );
};
