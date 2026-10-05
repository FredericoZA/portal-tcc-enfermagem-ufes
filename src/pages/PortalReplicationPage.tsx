import React from 'react';
import { Cloud, Code2, Database, Download, ExternalLink, FileText, Github, Server } from 'lucide-react';

const REPOSITORY_URL = 'https://github.com/FredericoZA/portal-tcc-enfermagem-ufes';

const tools = [
  {
    icon: Github,
    title: 'GitHub',
    text: 'Código-fonte, versões e documentação técnica para estudar, clonar e adaptar o Portal.',
    href: REPOSITORY_URL,
  },
  {
    icon: Server,
    title: 'Vercel',
    text: 'Hospedagem web, deploy automático e funções de servidor necessárias aos fluxos do Portal.',
  },
  {
    icon: Database,
    title: 'Supabase',
    text: 'Base operacional do sistema. Cada implantação deve usar projeto e banco próprios.',
  },
  {
    icon: Cloud,
    title: 'Google Workspace',
    text: 'Drive e Docs para documentos, Gmail para comunicações e Calendar para as defesas.',
  },
] as const;

const CARD_CLASS = 'portal-layer-card flex h-full min-h-[112px] flex-col rounded-xl border border-slate-300 p-2.5 shadow-2xs';

export const PortalReplicationPage: React.FC = () => {
  return (
    <div id="portal-replication-page" className="portal-public-shell portal-layer-panel mx-auto max-w-none overflow-hidden rounded-2xl border border-slate-300 shadow-sm">
      <section className="portal-public-header px-3.5 text-white sm:px-4">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-300 bg-white shadow-2xs" aria-hidden="true"><Code2 className="h-4 w-4 text-slate-700" /></span>
          <h1 className="text-sm font-black uppercase tracking-tight text-white sm:text-base">Replicar Portal</h1>
        </div>
      </section>

      <section className="portal-layer-panel p-3 sm:p-4">
        <h2 className="text-xs font-black uppercase tracking-wide text-slate-900">Ferramentas utilizadas</h2>
        <p className="mt-1 max-w-5xl text-xs leading-4 text-slate-600">O Portal combina serviços independentes. Uma nova implantação pode manter a arquitetura atual ou substituir cada serviço por um equivalente compatível com sua realidade técnica e administrativa.</p>

        <div className="mt-3 grid auto-rows-fr items-stretch gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {tools.map(({ icon: Icon, title, text, ...tool }) => (
            <article key={title} className={CARD_CLASS}>
              <Icon className="h-5 w-5 text-[var(--portal-brand-action)]" />
              <h3 className="mt-1.5 text-sm font-black text-slate-950">{title}</h3>
              <p className="mt-1 text-xs leading-4 text-slate-600">{text}</p>
              {'href' in tool && tool.href ? (
                <div className="mt-auto pt-2">
                  <a href={tool.href} target="_blank" rel="noreferrer" className="portal-action-green inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[10px] font-black text-white shadow-sm">
                    Abrir no GitHub <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              ) : <div className="mt-auto pt-2" aria-hidden="true" />}
            </article>
          ))}

          <article className={CARD_CLASS}>
            <FileText className="h-5 w-5 text-[var(--portal-brand-action)]" />
            <h3 className="mt-1.5 text-sm font-black text-slate-950">Modelos do Google Drive</h3>
            <p className="mt-1 text-xs leading-4 text-slate-600">Baixe em ZIP os quatro modelos Word de referência para uma nova implantação.</p>
            <div className="mt-auto pt-2">
              <a
                href="/api/public/replication-models/all/download"
                download
                title="Baixar os quatro modelos em um único arquivo ZIP"
                className="portal-action-green inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[10px] font-black text-white shadow-sm"
              >
                <Download className="h-3.5 w-3.5" />
                Baixar modelos
              </a>
            </div>
          </article>
        </div>
      </section>
    </div>
  );
};
