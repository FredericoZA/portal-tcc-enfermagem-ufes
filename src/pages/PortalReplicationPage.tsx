import React from 'react';
import { CheckCircle2, Cloud, Code2, Database, ExternalLink, FileKey2, Github, Server, ShieldCheck, Workflow } from 'lucide-react';

const REPOSITORY_URL = 'https://github.com/Compilandog/portal-tcc-enfermagem-ufes';

const steps = [
  ['1. Obtenha o código', 'Faça fork ou clone do repositório e mantenha suas alterações em uma instalação própria.'],
  ['2. Crie o banco', 'Crie um projeto Supabase e aplique as migrations versionadas do repositório. Não copie dados da instalação UFES.'],
  ['3. Configure o Google', 'Crie credenciais OAuth próprias no Google Cloud, registre a URL de callback da sua implantação e autorize Drive, Docs, Gmail e Calendar conforme o guia.'],
  ['4. Prepare o Drive', 'Defina uma pasta raiz exclusiva da nova instalação. O Portal organiza modelos, processos, assinados e conteúdo público sem depender da pasta da UFES.'],
  ['5. Publique a aplicação', 'Importe o repositório na Vercel, configure Node 22 e as variáveis de ambiente exclusivamente no servidor.'],
  ['6. Faça o primeiro acesso Master', 'Defina o e-mail administrador da nova instituição e autorize Google e, se utilizar assinatura eletrônica, sua própria conta Asten.'],
  ['7. Personalize o curso', 'Troque instituição, curso, domínio de e-mail, identidade visual, locais, formulários, modelos DOCX, e-mails e fluxo.'],
  ['8. Homologue antes do uso', 'Rode os testes, execute a homologação assistida e simule um processo fictício completo antes de receber dados reais.']
] as const;

export const PortalReplicationPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-emerald-900/10 bg-gradient-to-br from-[#005830] to-[#013d2b] p-5 sm:p-7 text-white shadow-lg">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 text-emerald-100 text-xs font-black uppercase tracking-[0.18em]"><Code2 className="h-4 w-4"/>Projeto replicável</div>
            <h1 className="mt-2 text-2xl sm:text-3xl font-black tracking-tight">Crie o Portal TCC da sua instituição</h1>
            <p className="mt-2 text-sm sm:text-base leading-7 text-emerald-50">Este projeto foi estruturado para que outras instituições possam reutilizar a base técnica sem copiar dados, contas ou credenciais da UFES. Cada implantação deve possuir banco, Drive, OAuth e segredos próprios.</p>
          </div>
          <a href={REPOSITORY_URL} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-black text-[#005830] shadow-sm hover:bg-emerald-50">
            <Github className="h-5 w-5"/>Abrir GitHub <ExternalLink className="h-4 w-4"/>
          </a>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          [Github, 'GitHub', 'Código, histórico e atualizações'],
          [Server, 'Vercel', 'Hospedagem da aplicação'],
          [Database, 'Supabase', 'Banco, RLS e estado transacional'],
          [Cloud, 'Google Workspace', 'Drive, Docs, Gmail e Calendar']
        ].map(([Icon, title, text]) => {
          const ToolIcon = Icon as React.ComponentType<{ className?: string }>;
          return <div key={String(title)} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><ToolIcon className="h-5 w-5 text-[#005830]"/><h2 className="mt-2 font-black text-slate-950">{String(title)}</h2><p className="mt-1 text-sm text-slate-600">{String(text)}</p></div>;
        })}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2"><Workflow className="h-5 w-5 text-[#005830]"/><h2 className="font-black text-slate-950">Passo a passo de implantação</h2></div>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {steps.map(([title, description]) => (
            <article key={title} className="flex gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700"/>
              <div><h3 className="font-black text-slate-900">{title}</h3><p className="mt-1 text-sm leading-6 text-slate-600">{description}</p></div>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <div className="flex items-center gap-2"><FileKey2 className="h-5 w-5 text-amber-800"/><h2 className="font-black text-amber-950">O que nunca deve ser copiado</h2></div>
          <p className="mt-2 text-sm leading-6 text-amber-900">Chaves do Supabase, tokens Asten, segredos OAuth, cookies, e-mails de participantes, CPFs, matrículas, arquivos reais, refresh tokens e qualquer conteúdo da instalação de produção. O repositório deve conter apenas código, exemplos sem segredo e migrations reproduzíveis.</p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
          <div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-emerald-800"/><h2 className="font-black text-emerald-950">Licença prática de reutilização</h2></div>
          <p className="mt-2 text-sm leading-6 text-emerald-900">A intenção do projeto é facilitar a replicação e a adaptação por outras equipes. A visibilidade e a licença formal do repositório precisam estar configuradas no GitHub para que terceiros possam efetivamente cloná-lo. O Portal não presume que um repositório privado esteja publicamente acessível.</p>
        </div>
      </section>
    </div>
  );
};
