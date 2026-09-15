import React from 'react';
import { Cloud, Code2, Database, ExternalLink, FileText, Github, Globe2, Server } from 'lucide-react';

const REPOSITORY_URL = 'https://github.com/Compilandog/portal-tcc-enfermagem-ufes';

const tools = [
  { icon: Github, title: 'GitHub', text: 'Código-fonte, histórico e documentação técnica.' },
  { icon: Server, title: 'Vercel', text: 'Hospedagem, deploy e domínio da aplicação.' },
  { icon: Database, title: 'Supabase', text: 'Banco de dados e persistência do Portal.' },
  { icon: Cloud, title: 'Google Workspace', text: 'Drive, Docs, Gmail e Calendar.' },
  { icon: Globe2, title: 'Identidade institucional', text: 'Domínio, e-mail, curso e personalização visual.' },
] as const;

const modelNames = ['Ata de Defesa', 'Termo de Autorização', 'Declaração da Banca'] as const;

export const PortalReplicationPage: React.FC = () => (
  <div id="portal-replication-page" className="mx-auto max-w-5xl space-y-3 py-2">
    <section className="flex flex-col gap-2 rounded-2xl border border-emerald-900/80 bg-[#005830] px-3.5 py-3 text-white shadow-sm sm:flex-row sm:items-center sm:justify-between sm:px-4">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-300 bg-white shadow-2xs" aria-hidden="true">
          <Code2 className="h-4 w-4 text-slate-700" />
        </span>
        <h1 className="text-sm font-black uppercase tracking-tight text-white sm:text-base">Replicar Portal</h1>
      </div>
      <a
        href={REPOSITORY_URL}
        target="_blank"
        rel="noreferrer"
        className="inline-flex min-h-9 items-center justify-center gap-2 rounded-xl border border-white bg-white px-3 py-2 text-[11px] font-black uppercase tracking-wide text-slate-900 shadow-sm transition hover:brightness-95"
      >
        <Github className="h-4 w-4" />GitHub<ExternalLink className="h-3.5 w-3.5" />
      </a>
    </section>

    <section className="rounded-2xl border border-slate-300 bg-[#f0f0f0] p-3 shadow-sm sm:p-4">
      <h2 className="text-xs font-black uppercase tracking-wide text-slate-900">Ferramentas utilizadas</h2>
      <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {tools.map(({ icon: Icon, title, text }) => (
          <article key={title} className="rounded-xl border border-slate-200 bg-white p-3 shadow-2xs">
            <Icon className="h-5 w-5 text-[#337959]" />
            <h3 className="mt-1.5 text-sm font-black text-slate-950">{title}</h3>
            <p className="mt-0.5 text-xs leading-4 text-slate-600">{text}</p>
          </article>
        ))}
      </div>
    </section>

    <section className="grid gap-3 lg:grid-cols-[1fr_1.15fr]">
      <article className="rounded-2xl border border-slate-300 bg-[#f0f0f0] p-3 shadow-sm sm:p-4">
        <div className="flex items-center gap-2">
          <Github className="h-5 w-5 text-[#337959]" />
          <h2 className="text-sm font-black text-slate-950">Código do Portal</h2>
        </div>
        <p className="mt-1 text-xs leading-5 text-slate-600">O repositório reúne a aplicação, componentes e documentação necessários para quem quiser estudar ou adaptar a base técnica.</p>
        <a href={REPOSITORY_URL} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-black text-slate-900 shadow-sm hover:brightness-95">
          Abrir no GitHub <ExternalLink className="h-4 w-4" />
        </a>
      </article>

      <article className="rounded-2xl border border-slate-300 bg-[#f0f0f0] p-3 shadow-sm sm:p-4">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-[#337959]" />
          <h2 className="text-sm font-black text-slate-950">Modelos do Google Drive</h2>
        </div>
        <p className="mt-1 text-xs leading-5 text-slate-600">Os modelos institucionais devem ser compartilhados somente por links de cópia. Os arquivos originais usados pela Enfermagem não são expostos nesta página.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {modelNames.map((name) => (
            <div key={name} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-2xs">
              <div className="text-xs font-black text-slate-900">{name}</div>
              <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#337959]">Cópia do modelo</div>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[10px] leading-4 text-slate-500">Os botões de cópia serão vinculados apenas quando forem cadastradas versões públicas próprias para duplicação, sem apontar para os documentos operacionais de produção.</p>
      </article>
    </section>
  </div>
);
