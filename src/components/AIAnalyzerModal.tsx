import React, { useState } from 'react';
import { ZipItem, ZipStats } from '../types';
import { Sparkles, X, Send, Bot, User, Code2, BookOpen, AlertCircle, RefreshCw } from 'lucide-react';

interface AIAnalyzerModalProps {
  isOpen: boolean;
  onClose: () => void;
  zipName: string | null;
  items: ZipItem[];
  stats: ZipStats | null;
  activeFileContent?: { name: string; content: string } | null;
}

export const AIAnalyzerModal: React.FC<AIAnalyzerModalProps> = ({
  isOpen,
  onClose,
  zipName,
  items,
  stats,
  activeFileContent,
}) => {
  const [prompt, setPrompt] = useState<string>('');
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; text: string }>>([
    {
      role: 'assistant',
      text: `Olá! Sou seu assistente de Inteligência Artificial para análise do arquivo **${zipName || 'ZIP'}**.\n\nComo posso ajudar? Você pode me pedir para:\n- Explicar a estrutura geral deste projeto\n- Analisar um arquivo de código ou documento\n- Identificar frameworks, dependências e padrões\n- Sugerir melhorias ou encontrar possíveis problemas.`,
    },
  ]);
  const [loading, setLoading] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleSendPrompt = async (customPrompt?: string) => {
    const query = customPrompt || prompt;
    if (!query.trim() || loading) return;

    const userMsg = { role: 'user' as const, text: query };
    setMessages((prev) => [...prev, userMsg]);
    if (!customPrompt) setPrompt('');
    setLoading(true);

    try {
      const filesSummary = items.map((item) => ({
        path: item.path,
        size: item.size,
        isDir: item.dir,
      }));

      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: query,
          zipName,
          filesSummary,
          activeFileContent: activeFileContent ? `--- ${activeFileContent.name} ---\n${activeFileContent.content}` : null,
        }),
      });

      const data = await res.json();
      if (res.ok && data.text) {
        setMessages((prev) => [...prev, { role: 'assistant', text: data.text }]);
      } else {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', text: `⚠️ ${data.error || 'Erro ao comunicar com a IA.'}` },
        ]);
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', text: '⚠️ Falha ao se conectar com o servidor para análise.' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Sparkles className="w-5 h-5 text-yellow-300 animate-pulse" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-100 text-sm">Análise de Projeto & Código com IA</h3>
              <p className="text-xs text-slate-400">Powered by Gemini 2.5 Flash</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar análise"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Preset quick actions */}
        <div className="p-3 bg-slate-900/50 border-b border-slate-800/80 flex items-center gap-2 overflow-x-auto text-xs">
          <span className="text-slate-500 font-medium shrink-0">Sugestões rápidas:</span>
          <button
            onClick={() => handleSendPrompt('Faça um resumo geral da estrutura deste projeto e quais tecnologias ele usa.')}
            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 whitespace-nowrap"
          >
            🔍 Resumo Geral da Estrutura
          </button>
          <button
            onClick={() => handleSendPrompt('Quais são os principais arquivos e o ponto de entrada deste projeto?')}
            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 whitespace-nowrap"
          >
            🚀 Ponto de Entrada Principal
          </button>
          {activeFileContent && (
            <button
              onClick={() => handleSendPrompt(`Explique detalhadamente o arquivo ${activeFileContent.name}`)}
              className="px-2.5 py-1 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/30 whitespace-nowrap"
            >
              📄 Explicar {activeFileContent.name}
            </button>
          )}
        </div>

        {/* Chat History */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 rounded-xl bg-purple-600/20 text-purple-400 border border-purple-500/30 flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4" />
                </div>
              )}
              <div
                className={`max-w-[80%] p-4 rounded-2xl text-xs leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white font-medium rounded-br-xs'
                    : 'bg-slate-800/90 text-slate-200 border border-slate-700/80 rounded-bl-xs whitespace-pre-wrap'
                }`}
              >
                {msg.text}
              </div>
              {msg.role === 'user' && (
                <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex gap-3 justify-start items-center">
              <div className="w-8 h-8 rounded-xl bg-purple-600/20 text-purple-400 border border-purple-500/30 flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4" />
              </div>
              <div className="p-3 rounded-2xl bg-slate-800/90 border border-slate-700/80 text-xs text-slate-400 flex items-center gap-2">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-purple-400" />
                <span>Analisando o projeto e gerando resposta...</span>
              </div>
            </div>
          )}
        </div>

        {/* Prompt Input */}
        <div className="p-4 border-t border-slate-800 bg-slate-900">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendPrompt();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              placeholder="Digite uma pergunta sobre o arquivo ZIP ou seu código..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="flex-1 px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500"
            />
            <button
              type="submit"
              disabled={loading || !prompt.trim()}
              className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-all disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Enviar</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
