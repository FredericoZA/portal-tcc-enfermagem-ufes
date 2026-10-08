import React, { useState } from 'react';
import { ZipItem, ZipStats } from '../types';
import { Sparkles, Send, Bot, User, RefreshCw } from 'lucide-react';
import { PortalModalShell } from './PortalModalShell';

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
  activeFileContent,
}) => {
  const [prompt, setPrompt] = useState('');
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; text: string }>>([
    {
      role: 'assistant',
      text: `Olá! Sou seu assistente de análise do arquivo **${zipName || 'ZIP'}**. Posso explicar a estrutura, analisar arquivos, identificar tecnologias e sugerir melhorias.`,
    },
  ]);
  const [loading, setLoading] = useState(false);

  const handleSendPrompt = async (customPrompt?: string) => {
    const query = customPrompt || prompt;
    if (!query.trim() || loading) return;
    setMessages((prev) => [...prev, { role: 'user', text: query }]);
    if (!customPrompt) setPrompt('');
    setLoading(true);
    try {
      const filesSummary = items.map((item) => ({ path: item.path, size: item.size, isDir: item.dir }));
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
      setMessages((prev) => [...prev, { role: 'assistant', text: res.ok && data.text ? data.text : (data.error || 'Erro ao comunicar com a IA.') }]);
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', text: 'Falha ao se conectar com o servidor para análise.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <PortalModalShell
      open={isOpen}
      onClose={onClose}
      title="Análise de projeto e código com IA"
      subtitle={zipName || 'Arquivo ZIP'}
      icon={Sparkles}
      maxWidthClass="max-w-3xl"
      heightClass="h-[min(85vh,760px)]"
      bodyClassName="flex min-h-0 flex-1 flex-col p-3"
    >
      <section className="portal-modal-card mb-3 flex shrink-0 items-center gap-2 overflow-x-auto p-3 text-xs">
        <span className="shrink-0 font-bold text-slate-600">Sugestões rápidas:</span>
        <button type="button" onClick={() => handleSendPrompt('Faça um resumo geral da estrutura deste projeto e quais tecnologias ele usa.')} className="portal-action whitespace-nowrap">Resumo geral</button>
        <button type="button" onClick={() => handleSendPrompt('Quais são os principais arquivos e o ponto de entrada deste projeto?')} className="portal-action whitespace-nowrap">Ponto de entrada</button>
        {activeFileContent && <button type="button" onClick={() => handleSendPrompt(`Explique detalhadamente o arquivo ${activeFileContent.name}`)} className="portal-action portal-action-primary whitespace-nowrap">Explicar arquivo</button>}
      </section>

      <section className="portal-modal-card min-h-0 flex-1 overflow-y-auto p-4">
        <div className="space-y-3">
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'assistant' && <span className="portal-modal-inner flex h-8 w-8 shrink-0 items-center justify-center"><Bot className="h-4 w-4 text-[var(--portal-brand-action)]" /></span>}
              <div className={`max-w-[82%] rounded-xl border p-3 text-xs leading-relaxed ${msg.role === 'user' ? 'border-[var(--portal-brand-action-border)] bg-[var(--portal-brand-action)] text-white' : 'border-[var(--portal-border)] bg-white text-slate-800 whitespace-pre-wrap'}`}>{msg.text}</div>
              {msg.role === 'user' && <span className="portal-modal-inner flex h-8 w-8 shrink-0 items-center justify-center"><User className="h-4 w-4 text-[var(--portal-brand-action)]" /></span>}
            </div>
          ))}
          {loading && <div className="flex items-center gap-2 text-xs text-slate-600"><RefreshCw className="h-4 w-4 animate-spin text-[var(--portal-brand-action)]" />Analisando o projeto e gerando resposta...</div>}
        </div>
      </section>

      <form onSubmit={(e) => { e.preventDefault(); void handleSendPrompt(); }} className="mt-3 flex shrink-0 items-center gap-2">
        <input type="text" placeholder="Digite uma pergunta sobre o arquivo ZIP ou seu código..." value={prompt} onChange={(e) => setPrompt(e.target.value)} className="portal-input flex-1" />
        <button type="submit" disabled={loading || !prompt.trim()} className="portal-action portal-action-primary disabled:opacity-50"><Send className="h-3.5 w-3.5" />Enviar</button>
      </form>
    </PortalModalShell>
  );
};
