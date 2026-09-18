import React from 'react';
import { Cloud, Code2, Database, Download, ExternalLink, FileText, Github, Globe2, Server } from 'lucide-react';

const REPOSITORY_URL = 'https://github.com/Compilandog/portal-tcc-enfermagem-ufes';

const tools = [
  { icon: Github, title: 'GitHub', text: 'Reúne o código-fonte do Portal, histórico de versões e documentação técnica. É o ponto de partida para estudar, clonar e adaptar a aplicação para outro curso ou secretaria.' },
  { icon: Server, title: 'Vercel', text: 'Hospeda a aplicação web e publica as novas versões a partir do repositório. O projeto também utiliza as funções de servidor necessárias para os fluxos do Portal.' },
  { icon: Database, title: 'Supabase', text: 'Mantém a persistência dos dados operacionais do sistema. Cada nova implantação deve usar seu próprio projeto e sua própria base, sem depender dos dados da Enfermagem.' },
  { icon: Cloud, title: 'Google Workspace', text: 'Integra Drive e Docs para modelos e documentos, Gmail para comunicações e Calendar para os eventos de defesa. A nova instalação conecta a conta Google que irá operar o curso.' },
  { icon: Globe2, title: 'Identidade institucional', text: 'Nome do curso, domínio, e-mails, logotipos e elementos visuais são configuráveis. Assim, a mesma base pode receber a identidade de outra unidade sem copiar a operação da Enfermagem.' },
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

      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        {tools.map(({ icon: Icon, title, text }) => (
          <article key={title} className="portal-layer-card rounded-xl border border-slate-300 bg-[#d5dce0] p-3 shadow-2xs">
            <Icon className="h-5 w-5 text-[#337959]" />
            <h3 className="mt-1.5 text-sm font-black text-slate-950">{title}</h3>
            <p className="mt-1 text-xs leading-5 text-slate-600">{text}</p>
          </article>
        ))}
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-[0.82fr_1.45fr]">
        <article className="portal-layer-card rounded-2xl border border-slate-300 bg-[#d5dce0] p-3 shadow-sm sm:p-4">
          <div className="flex items-center gap-2">
            <Github className="h-5 w-5 text-[#337959]" />
            <h2 className="text-sm font-black text-slate-950">Código do Portal</h2>
          </div>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            O repositório contém a aplicação e o histórico técnico do projeto. Ele permite estudar a estrutura existente, criar uma cópia do código e evoluir a nova instalação sem começar o sistema do zero.
          </p>
          <a
            href={REPOSITORY_URL}
            target="_blank"
            rel="noreferrer"
            className="portal-action-green mt-3 inline-flex items-center gap-2 rounded-xl border border-[#2d6c50] bg-[#337959] px-3 py-2 text-xs font-black text-white shadow-sm hover:brightness-95"
          >
            Abrir no GitHub <ExternalLink className="h-4 w-4" />
          </a>
        </article>

        <article className="portal-layer-card rounded-2xl border border-slate-300 bg-[#d5dce0] p-3 shadow-sm sm:p-4">
          <div className="flex items-center gap-2">
            <span className="portal-layer-inner flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white shadow-2xs" aria-hidden="true">
              <FileText className="h-4 w-4 text-[#337959]" />
            </span>
            <h2 className="text-sm font-black text-slate-950">Modelos do Google Drive</h2>
          </div>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            Baixe cópias independentes em Word para adaptação em outra implantação. Os arquivos usados na operação atual do Portal permanecem separados dessas cópias.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {models.map(({ slug, label }) => (
              <a
                key={slug}
                href={`/api/public/replication-models/${slug}/download`}
                className="portal-action-green portal-replication-model-action inline-flex items-center gap-3 border border-[#2d6c50] bg-[#337959] text-xs font-black text-white shadow-sm"
              >
                <span className="truncate">{label}</span>
                <span className="inline-flex shrink-0 items-center gap-1 text-[9px] font-black uppercase tracking-wide">
                  <Download className="h-3.5 w-3.5" /> Baixar modelo
                </span>
              </a>
            ))}
          </div>
        </article>
      </div>
    </section>
  </div>
);
