import { portalConfirm } from '../services/portalDialogs';
import React, { useState } from 'react';
import {
  LoginPopupConfig,
  DEFAULT_LOGIN_POPUP_CONFIG,
  saveLoginPopupConfig
} from '../utils/loginPopupConfig';
import { NursingEmblemLogo } from './NursingEmblemLogo';
import {
  X,
  Sparkles,
  RotateCcw,
  Check,
  Palette,
  Layout,
  Type,
  Mail,
  ArrowRight,
  Shield,
  Info,
  Sliders,
  CheckCircle2,
  Lock
} from 'lucide-react';

interface LoginPopupEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialConfig?: LoginPopupConfig;
  onSave?: (saved: LoginPopupConfig) => void;
}

const THEME_OPTIONS: Array<{
  id: LoginPopupConfig['headerTheme'];
  name: string;
  badgeBg: string;
  headerBg: string;
  btnBg: string;
  accentText: string;
}> = [
  { id: 'emerald', name: 'Esmeralda Institucional', badgeBg: 'bg-emerald-600', headerBg: 'bg-emerald-50/80 border-emerald-200', btnBg: 'bg-[#005830] hover:bg-[#004827]', accentText: 'text-emerald-800' },
  { id: 'slate', name: 'Grafite Executivo', badgeBg: 'bg-slate-800', headerBg: 'bg-slate-100 border-slate-300', btnBg: 'bg-slate-900 hover:bg-slate-800', accentText: 'text-slate-900' },
  { id: 'blue', name: 'Azul Universidade', badgeBg: 'bg-blue-600', headerBg: 'bg-blue-50/80 border-blue-200', btnBg: 'bg-blue-700 hover:bg-blue-800', accentText: 'text-blue-800' },
  { id: 'purple', name: 'Púrpura Acadêmico', badgeBg: 'bg-purple-600', headerBg: 'bg-purple-50/80 border-purple-200', btnBg: 'bg-purple-700 hover:bg-purple-800', accentText: 'text-purple-800' },
  { id: 'indigo', name: 'Índigo Moderno', badgeBg: 'bg-indigo-600', headerBg: 'bg-indigo-50/80 border-indigo-200', btnBg: 'bg-indigo-700 hover:bg-indigo-800', accentText: 'text-indigo-800' },
  { id: 'amber', name: 'Âmbar Dourado', badgeBg: 'bg-amber-600', headerBg: 'bg-amber-50/80 border-amber-200', btnBg: 'bg-amber-700 hover:bg-amber-800', accentText: 'text-amber-800' },
  { id: 'rose', name: 'Rosa Coral', badgeBg: 'bg-rose-600', headerBg: 'bg-rose-50/80 border-rose-200', btnBg: 'bg-rose-700 hover:bg-rose-800', accentText: 'text-rose-800' }
];

export const LoginPopupEditorModal: React.FC<LoginPopupEditorModalProps> = ({
  isOpen,
  onClose,
  initialConfig = DEFAULT_LOGIN_POPUP_CONFIG,
  onSave
}) => {
  const [config, setConfig] = useState<LoginPopupConfig>(() => ({ ...DEFAULT_LOGIN_POPUP_CONFIG, ...initialConfig }));
  const [activeTab, setActiveTab] = useState<'textos' | 'estilo' | 'elementos'>('textos');
  const [previewEmail, setPreviewEmail] = useState('');
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSave = () => {
    saveLoginPopupConfig(config);
    if (onSave) onSave(config);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 800);
  };

  const handleReset = async () => {
    if ((await portalConfirm('Deseja restaurar os padrões institucionais do popup de login?'))) {
      setConfig({ ...DEFAULT_LOGIN_POPUP_CONFIG });
    }
  };

  const currentTheme = THEME_OPTIONS.find((t) => t.id === config.headerTheme) || THEME_OPTIONS[0];

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-300 w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
        
        {/* TOP BAR */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-600/30 border border-purple-400/40 text-purple-300 flex items-center justify-center shadow-xs">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-black uppercase tracking-wider text-white flex items-center gap-2">
                <span>Personalizar Popup de Login & Acesso</span>
                <span className="text-[10px] bg-purple-500/20 text-purple-200 border border-purple-400/30 px-2 py-0.5 rounded font-mono">
                  Visual em Tempo Real
                </span>
              </h2>
              <p className="text-xs text-slate-400 font-medium">
                Configure textos, logotipo, dicas para discentes/docentes, paletas de cores e rodapé de segurança
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleReset}
              className="px-3 py-1.5 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Restaurar Padrão</span>
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
            >
              {savedSuccess ? <Check className="w-4 h-4" /> : <Sparkles className="w-3.5 h-3.5" />}
              <span>{savedSuccess ? 'Salvo!' : 'Salvar Alterações'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar editor de acesso"
              className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer ml-2"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* WORKSPACE AREA: 2 COLUMNS (CONTROLS LEFT, LIVE PREVIEW RIGHT) */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 min-h-0 overflow-hidden bg-slate-100">
          
          {/* LEFT: CONTROLS PANEL (5 COLS) */}
          <div className="lg:col-span-5 bg-white border-r border-slate-200 flex flex-col h-full overflow-hidden">
            {/* TABS */}
            <div className="flex border-b border-slate-200 bg-slate-50 p-1.5 gap-1 shrink-0">
              <button
                type="button"
                onClick={() => setActiveTab('textos')}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'textos'
                    ? 'bg-white text-purple-900 shadow-xs border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Type className="w-3.5 h-3.5" />
                <span>Textos</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('estilo')}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'estilo'
                    ? 'bg-white text-purple-900 shadow-xs border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Palette className="w-3.5 h-3.5" />
                <span>Cores & Estilo</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('elementos')}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'elementos'
                    ? 'bg-white text-purple-900 shadow-xs border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Elementos</span>
              </button>
            </div>

            {/* TAB CONTENTS */}
            <div className="p-5 flex-1 overflow-y-auto custom-scrollbar space-y-4">
              
              {/* TAB 1: TEXTOS */}
              {activeTab === 'textos' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                      Título do Modal
                    </label>
                    <input
                      type="text"
                      value={config.title}
                      onChange={(e) => setConfig({ ...config, title: e.target.value })}
                      className="w-full text-xs font-semibold px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                      Subtítulo Institucional
                    </label>
                    <input
                      type="text"
                      value={config.subtitle}
                      onChange={(e) => setConfig({ ...config, subtitle: e.target.value })}
                      className="w-full text-xs font-semibold px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                      Instruções / Descrição
                    </label>
                    <textarea
                      rows={3}
                      value={config.description}
                      onChange={(e) => setConfig({ ...config, description: e.target.value })}
                      className="w-full text-xs font-normal px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none leading-relaxed"
                    />
                  </div>

                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                    <span className="text-[11px] font-black uppercase text-slate-800 block">
                      Dicas na Caixa Informativa
                    </span>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-1">
                        Orientação Discentes:
                      </label>
                      <input
                        type="text"
                        value={config.discenteTip}
                        onChange={(e) => setConfig({ ...config, discenteTip: e.target.value })}
                        className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-1">
                        Orientação Docentes & Banca:
                      </label>
                      <input
                        type="text"
                        value={config.docenteTip}
                        onChange={(e) => setConfig({ ...config, docenteTip: e.target.value })}
                        className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                      Rótulo do Campo de E-mail
                    </label>
                    <input
                      type="text"
                      value={config.emailLabel}
                      onChange={(e) => setConfig({ ...config, emailLabel: e.target.value })}
                      className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                      Placeholder do Campo de E-mail
                    </label>
                    <input
                      type="text"
                      value={config.emailPlaceholder}
                      onChange={(e) => setConfig({ ...config, emailPlaceholder: e.target.value })}
                      className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                      Texto do Botão de Ação
                    </label>
                    <input
                      type="text"
                      value={config.buttonText}
                      onChange={(e) => setConfig({ ...config, buttonText: e.target.value })}
                      className="w-full text-xs font-bold px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none"
                    />
                  </div>
                </div>
              )}

              {/* TAB 2: CORES & ESTILO */}
              {activeTab === 'estilo' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-2">
                      Tema de Cores do Cabeçalho & Botão
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {THEME_OPTIONS.map((theme) => (
                        <button
                          key={theme.id}
                          type="button"
                          onClick={() => setConfig({ ...config, headerTheme: theme.id })}
                          className={`p-3 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                            config.headerTheme === theme.id
                              ? 'border-purple-600 bg-purple-50 ring-2 ring-purple-200'
                              : 'border-slate-200 bg-white hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <span className={`w-4 h-4 rounded-full ${theme.badgeBg}`} />
                            <span className="text-xs font-bold text-slate-800">{theme.name}</span>
                          </div>
                          {config.headerTheme === theme.id && (
                            <CheckCircle2 className="w-4 h-4 text-purple-600" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-2">
                      Arredondamento dos Cantos
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                      {(['rounded-lg', 'rounded-xl', 'rounded-2xl', 'rounded-3xl'] as const).map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setConfig({ ...config, borderRadius: r })}
                          className={`py-2 px-2 rounded-xl text-center text-xs font-bold transition-all border cursor-pointer ${
                            config.borderRadius === r
                              ? 'border-purple-600 bg-purple-50 text-purple-900'
                              : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                          }`}
                        >
                          {r.replace('rounded-', '')}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: ELEMENTOS & EXIBIÇÃO */}
              {activeTab === 'elementos' && (
                <div className="space-y-4">
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                    <span className="text-xs font-black uppercase text-slate-900 block">
                      Elementos Visíveis
                    </span>

                    <label className="flex items-center justify-between cursor-pointer py-1">
                      <span className="text-xs font-semibold text-slate-700">
                        Logo institucional no cabeçalho
                      </span>
                      <input
                        type="checkbox"
                        checked={config.showLogo}
                        onChange={(e) => setConfig({ ...config, showLogo: e.target.checked })}
                        className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500"
                      />
                    </label>

                    <label className="flex items-center justify-between cursor-pointer py-1">
                      <span className="text-xs font-semibold text-slate-700">
                        Caixa de Orientações Institucionais
                      </span>
                      <input
                        type="checkbox"
                        checked={config.showTipsBox}
                        onChange={(e) => setConfig({ ...config, showTipsBox: e.target.checked })}
                        className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500"
                      />
                    </label>

                    <label className="flex items-center justify-between cursor-pointer py-1">
                      <span className="text-xs font-semibold text-slate-700">
                        Barra Inferior de Segurança & Localização
                      </span>
                      <input
                        type="checkbox"
                        checked={config.showSecurityFooter}
                        onChange={(e) => setConfig({ ...config, showSecurityFooter: e.target.checked })}
                        className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500"
                      />
                    </label>
                  </div>

                  {config.showSecurityFooter && (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                          Texto de Segurança (Esquerda)
                        </label>
                        <input
                          type="text"
                          value={config.securityText}
                          onChange={(e) => setConfig({ ...config, securityText: e.target.value })}
                          className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                          Texto de Localização (Direita)
                        </label>
                        <input
                          type="text"
                          value={config.locationText}
                          onChange={(e) => setConfig({ ...config, locationText: e.target.value })}
                          className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>

          {/* RIGHT: LIVE PREVIEW (7 COLS) */}
          <div className="lg:col-span-7 bg-slate-900/90 flex flex-col items-center justify-center p-4 sm:p-8 overflow-y-auto custom-scrollbar">
            <div className="w-full max-w-lg">
              <div className="mb-2 flex items-center justify-between text-[11px] text-slate-400 font-mono">
                <span>PREVIEW AO VIVO DO POPUP</span>
                <span className="text-emerald-400 font-bold">● Sincronizado</span>
              </div>

              {/* MOCKED MODAL PREVIEW */}
              <div className={`bg-white ${config.borderRadius} border border-slate-200/90 shadow-2xl overflow-hidden`}>
                
                {/* Header */}
                <div className={`${currentTheme.headerBg} border-b px-5 py-4 flex items-center justify-between`}>
                  <div className="flex items-center gap-3">
                    {config.showLogo && (
                      <div className="w-10 h-10 rounded-xl bg-white border border-slate-200/80 flex items-center justify-center shadow-2xs shrink-0">
                        <NursingEmblemLogo size={28} />
                      </div>
                    )}
                    <div>
                      <h3 className="font-bold text-sm text-slate-900 leading-tight">
                        {config.title || 'Acesso ao Portal do TCC'}
                      </h3>
                      <p className={`text-[11px] ${currentTheme.accentText} font-medium`}>
                        {config.subtitle || 'Curso • Instituição'}
                      </p>
                    </div>
                  </div>
                  <div className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 flex items-center justify-center transition-colors">
                    <X className="w-4 h-4" />
                  </div>
                </div>

                {/* Content */}
                <div className="p-5 sm:p-6 space-y-4">
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {config.description}
                  </p>

                  {config.showTipsBox && (
                    <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200/80 space-y-1.5 text-[11.5px] text-slate-700">
                      <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                        <Info className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <span>Orientações para identificação:</span>
                      </div>
                      <ul className="space-y-1 pl-5 list-disc text-slate-600 text-[11px]">
                        <li><strong>Discentes:</strong> {config.discenteTip}</li>
                        <li><strong>Docentes e Banca:</strong> {config.docenteTip}</li>
                      </ul>
                    </div>
                  )}

                  <div className="space-y-4 pt-1">
                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700">
                        {config.emailLabel} <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="email"
                          placeholder={config.emailPlaceholder}
                          value={previewEmail}
                          onChange={(e) => setPreviewEmail(e.target.value)}
                          className="w-full bg-white border border-slate-300 text-slate-900 pl-10 pr-4 py-2.5 text-xs rounded-xl outline-none font-medium placeholder:text-slate-400"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                      <button
                        type="button"
                        className="px-4 py-2 bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl border border-slate-200"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        className={`px-5 py-2 ${currentTheme.btnBg} text-white text-xs font-bold uppercase tracking-wide rounded-xl flex items-center gap-2 shadow-2xs`}
                      >
                        <span>{config.buttonText}</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Footer Security */}
                {config.showSecurityFooter && (
                  <div className="bg-slate-50/70 border-t border-slate-200 px-5 py-2.5 flex items-center justify-between text-[10.5px] text-slate-500">
                    <span className="flex items-center gap-1">
                      <Shield className="w-3 h-3 text-slate-400" />
                      {config.securityText}
                    </span>
                    <span>{config.locationText}</span>
                  </div>
                )}

              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
