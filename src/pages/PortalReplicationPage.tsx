import React from 'react';
import { Cloud, Code2, Database, Download, ExternalLink, FileText, Github, Server } from 'lucide-react';

const REPOSITORY_URL = 'https://github.com/Compilandog/portal-tcc-enfermagem-ufes';

const tools = [
  {
    icon: Github,
    title: 'GitHub',
    text: 'Reúne o código-fonte do Portal, histórico de versões e documentação técnica. É o ponto de partida para estudar, clonar e adaptar a aplicação para outro curso ou secretaria.',
    href: REPOSITORY_URL,
  },
  { icon: Server, title: 'Vercel', text: 'Hospeda a aplicação web e publica as novas versões a partir do repositório. O projeto também utiliza as funções de servidor necessárias para os fluxos do Portal.' },
  { icon: Database, title: 'Supabase', text: 'Mantém a persistência dos dados operacionais do sistema. Cada nova implantação deve usar seu próprio projeto e sua própria base, sem depender dos dados da Enfermagem.' },
  { icon: Cloud, title: 'Google Workspace', text: 'Integra Drive e Docs para modelos e documentos, Gmail para comunicações e Calendar para os eventos de defesa. A nova instalação conecta a conta Google que irá operar o curso.' },
] as const;

const models = [
  { slug: 'convite', label: 'Convite de Defesa' },
  { slug: 'termo', label: 'Termo de Autorização' },
  { slug: 'ata', label: 'Ata de Defesa' },
  { slug: 'declaracao', label: 'Declaração da Banca' },
] as const;

export const PortalReplicationPage: React.FC = () => (
  <div id="portal-replication-page" className="portal-public-shell mx-auto max-w-none overflow-hidden rounded-2xl border border-slate-300 bg-[#e1e6e9] shadow-sm">
    <section className="portal-public-header border-b-2 border-white bg-[#005830] px-3.5 py-3 text-white sm:px-4">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-300 bg-white shadow-2xs" aria-hidden="true">
          <Code2 className="h-4 w-4 text-slate-700" />
        </span>
        <h1 className="text-sm font-black uppercase tracking-tight text-white sm:text-base">Replicar Portal</h1>
      </div>
    </section>

    <section className="portal-layer-panel bg-[#e1e6e9] p-3 sm:p-4">
      <h2 className="text-xs font-black uppercase tracking-wide text-slate-900">Ferramentas utilizadas</h2>
      <p className="mt-1 max-w-5xl text-xs leading-5 text-slate-600">
        O Portal combina serviços diferentes, cada um com uma função clara. Quem quiser reaproveitar a plataforma pode manter essa arquitetura ou substituir componentes equivalentes conforme a realidade da nova implantação.
      </p>

      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {tools.map(({ icon: Icon, title, text, ...tool }) => (
          <article key={title} className="portal-layer-card flex min-h-[150px] flex-col rounded-xl border border-slate-300 bg-[#d5dce0] p-3 shadow-2xs">
            <Icon className="h-5 w-5 text-[#337959]" />
            <h3 className="mt-1.5 text-sm font-black text-slate-950">{title}</h3>
            <p className="mt-1 text-xs leading-5 text-slate-600">{text}</p>
            {'href' in tool && tool.href ? (
              <div className="mt-auto pt-3">
                <a
                  href={tool.href}
                  target="_blank"
                  rel="noreferrer"
                  className="portal-action-green inline-flex w-fit items-center gap-1.5 rounded-lg border border-[#2d6c50] bg-[#337959] px-2.5 py-1.5 text-[10px] font-black text-white shadow-sm hover:brightness-95"
                >
                  Abrir no GitHub <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            ) : null}
          </article>
        ))}

        <article className="portal-layer-card flex min-h-[150px] flex-col rounded-xl border border-slate-300 bg-[#d5dce0] p-3 shadow-2xs">
          <FileText className="h-5 w-5 text-[#337959]" />
          <h3 className="mt-1.5 text-sm font-black text-slate-950">Modelos do Google Drive</h3>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            Baixe cópias independentes em Word para adaptar os documentos a outra implantação sem alterar os modelos usados na operação atual.
          </p>
          <details className="mt-auto pt-3">
            <summary className="portal-action-green w-fit cursor-pointer list-none rounded-lg border border-[#2d6c50] bg-[#337959] px-2.5 py-1.5 text-[10px] font-black text-white shadow-sm hover:brightness-95">
              <span className="inline-flex items-center gap-1.5"><Download className="h-3.5 w-3.5" /> Baixar modelos</span>
            </summary>
            <div className="mt-2 grid gap-1.5">
              {models.map(({ slug, label }) => (
                <a
                  key={slug}
                  href={`/api/public/replication-models/${slug}/download`}
                  className="portal-layer-inner flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[10px] font-bold text-slate-800 hover:bg-slate-50"
                >
                  <span>{label}</span>
                  <Download className="h-3.5 w-3.5 shrink-0 text-[#337959]" />
                </a>
              ))}
            </div>
          </details>
        </article>
      </div>
    </section>
  </div>
);
