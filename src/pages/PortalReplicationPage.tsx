import React from 'react';
import { CheckCircle2, Cloud, Code2, Database, ExternalLink, FileKey2, Github, Server, ShieldCheck, Workflow } from 'lucide-react';

const REPOSITORY_URL = 'https://github.com/Compilandog/portal-tcc-enfermagem-ufes';

const steps = [
  ['1. Copie a base', 'Faça fork ou clone do repositório para a nova secretaria e mantenha a instalação independente.'],
  ['2. Crie o banco', 'Crie um projeto Supabase próprio e aplique as migrations versionadas. Nunca copie os dados da Enfermagem.'],
  ['3. Configure o Google', 'Crie credenciais OAuth da nova instalação e autorize Drive, Docs, Gmail e Calendar com a conta institucional escolhida.'],
  ['4. Prepare o Drive', 'Defina uma pasta raiz exclusiva. Modelos, processos, assinados e publicações permanecem separados entre os cursos.'],
  ['5. Publique na Vercel', 'Importe o repositório, use Node 22 e configure as variáveis e segredos exclusivamente no servidor.'],
  ['6. Defina o Master', 'Cadastre o administrador inicial da secretaria e autorize as integrações da própria instalação.'],
  ['7. Personalize o curso', 'Troque identidade, domínio, locais, formulários, modelos, e-mails, fluxo e regras acadêmicas.'],
  ['8. Homologue', 'Execute CI, smoke de produção e um processo fictício completo antes de receber dados reais.']
] as const;

export const PortalReplicationPage: React.FC = () => (
  <div className="space-y-4">
    <section className="rounded-2xl border border-[#344125]/25 bg-[#344125] p-5 text-white shadow-sm sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-3xl">
          <div className="flex items-center gap-2 text-slate-200 text-xs font-black uppercase tracking-[0.16em]"><Code2 className="h-4 w-4"/>Projeto replicável</div>
          <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">Leve o Portal TCC para outra secretaria</h1>
          <p className="mt-2 text-sm leading-6 text-slate-100">A base pode ser reutilizada por outros cursos da UFES sem compartilhar banco, Drive, contas, credenciais ou dados desta instalação.</p>
        </div>
        <a href={REPOSITORY_URL} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-600 px-4 py-2.5 text-sm font-black text-white shadow-sm hover:bg-slate-700">
          <Github className="h-5 w-5"/>Abrir projeto <ExternalLink className="h-4 w-4"/>
        </a>
      </div>
    </section>

    <section className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      {[
        [Github, 'GitHub', 'Código e histórico'],
        [Server, 'Vercel', 'Hospedagem'],
        [Database, 'Supabase', 'Banco e estado'],
        [Cloud, 'Google Workspace', 'Drive, Docs, Gmail e Calendar']
      ].map(([Icon, title, text]) => {
        const ToolIcon = Icon as React.ComponentType<{ className?: string }>;
        return <div key={String(title)} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"><ToolIcon className="h-5 w-5 text-slate-600"/><h2 className="mt-1.5 font-black text-slate-950">{String(title)}</h2><p className="mt-0.5 text-xs text-slate-600">{String(text)}</p></div>;
      })}
    </section>

    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2"><Workflow className="h-5 w-5 text-slate-600"/><h2 className="font-black text-slate-950">Implantação em outra secretaria</h2></div>
      <div className="mt-3 grid gap-2 lg:grid-cols-2">
        {steps.map(([title, description]) => (
          <article key={title} className="flex gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-slate-600"/>
            <div><h3 className="text-sm font-black text-slate-900">{title}</h3><p className="mt-0.5 text-xs leading-5 text-slate-600">{description}</p></div>
          </article>
        ))}
      </div>
    </section>

    <section className="grid gap-3 lg:grid-cols-2">
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
        <div className="flex items-center gap-2"><FileKey2 className="h-5 w-5 text-amber-800"/><h2 className="font-black text-amber-950">Nunca copie dados e segredos</h2></div>
        <p className="mt-1.5 text-xs leading-5 text-amber-900">Chaves, tokens, cookies, e-mails, matrículas, PDFs reais, refresh tokens, banco e pasta de produção pertencem exclusivamente à instalação de origem.</p>
      </div>
      <div className="rounded-xl border border-slate-300 bg-slate-50 p-4">
        <div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-slate-700"/><h2 className="font-black text-slate-950">Isolamento obrigatório</h2></div>
        <p className="mt-1.5 text-xs leading-5 text-slate-700">Cada curso usa banco, Drive, OAuth, segredos e contas próprios. A replicação reaproveita a base técnica, não a instalação operacional da Enfermagem.</p>
      </div>
    </section>
  </div>
);
