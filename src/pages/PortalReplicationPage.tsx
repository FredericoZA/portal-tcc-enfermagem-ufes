import React from 'react';
import {
  CheckCircle2,
  Cloud,
  Code2,
  Database,
  ExternalLink,
  FileKey2,
  Github,
  Globe2,
  Mail,
  Server,
  ShieldCheck,
  Workflow,
} from 'lucide-react';

const REPOSITORY_URL = 'https://github.com/Compilandog/portal-tcc-enfermagem-ufes';
const ACCENT = '#47866A';

const steps = [
  ['1. Crie a instalação', 'Faça fork ou clone da base para a nova secretaria e mantenha o histórico e a implantação independentes.', 'Saída: repositório próprio.'],
  ['2. Prepare o Supabase', 'Crie banco próprio, aplique as migrations versionadas e valide tabelas, políticas e funções.', 'Saída: banco vazio e funcional.'],
  ['3. Configure o Google', 'Crie OAuth e conta institucional próprios para Drive, Docs, Gmail e Calendar.', 'Saída: integrações autorizadas.'],
  ['4. Isole o Drive', 'Crie pasta raiz exclusiva para modelos, processos, assinados e publicações.', 'Saída: armazenamento separado.'],
  ['5. Publique na Vercel', 'Importe o projeto e configure somente as variáveis e segredos da nova instalação.', 'Saída: ambiente de homologação.'],
  ['6. Defina o Master', 'Cadastre o administrador inicial e valide o acesso administrativo da nova secretaria.', 'Saída: governança inicial.'],
  ['7. Personalize o curso', 'Revise identidade, domínio, locais, modelos, e-mails, regras acadêmicas e fluxo.', 'Saída: portal institucionalizado.'],
  ['8. Homologue antes do uso', 'Rode CI, smoke e um processo fictício completo; corrija qualquer regressão antes de dados reais.', 'Saída: liberação controlada.'],
] as const;

const isolationRows = [
  ['Banco / Supabase', 'Novo projeto', 'Nunca reutilizar dados de produção'],
  ['Drive', 'Nova pasta raiz', 'Arquivos e permissões separados'],
  ['Google OAuth', 'Novas credenciais', 'Conta institucional da nova secretaria'],
  ['Vercel', 'Novo projeto/ambiente', 'Variáveis e segredos próprios'],
  ['Domínio e e-mail', 'Identidade própria', 'Evita mistura entre cursos'],
  ['Administrador Master', 'Novo responsável', 'Governança local da instalação'],
] as const;

const releaseChecks = [
  'CI e build sem falhas',
  'Login e permissões testados por perfil',
  'Processo fictício executado do cadastro à conclusão',
  'Geração, assinatura e publicação documental verificadas',
  'Backup e caminho de rollback definidos',
  'Nenhum dado, token ou segredo da instalação de origem presente',
] as const;

export const PortalReplicationPage: React.FC = () => (
  <div className="space-y-3">
    <section className="rounded-2xl border border-[#005830]/30 bg-[#005830] p-4 text-white shadow-sm sm:p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-3xl">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-white/80"><Code2 className="h-4 w-4"/>Replicação segura</div>
          <h1 className="mt-1.5 text-2xl font-black tracking-tight sm:text-3xl">Implante o Portal TCC em outra secretaria</h1>
          <p className="mt-1.5 text-sm leading-6 text-white/85">Reaproveite a base técnica sem misturar banco, Drive, credenciais, contas ou dados. Cada curso deve operar como uma instalação independente.</p>
        </div>
        <a href={REPOSITORY_URL} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-black text-white shadow-sm transition hover:brightness-95" style={{ backgroundColor: ACCENT, borderColor: ACCENT }}>
          <Github className="h-5 w-5"/>Abrir projeto <ExternalLink className="h-4 w-4"/>
        </a>
      </div>
    </section>

    <section className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
      {[
        [Github, 'GitHub', 'Código e histórico'],
        [Server, 'Vercel', 'Deploy e ambiente'],
        [Database, 'Supabase', 'Banco e estado'],
        [Cloud, 'Google', 'Drive, Docs, Gmail e Calendar'],
        [Globe2, 'Identidade', 'Domínio, e-mail e curso'],
      ].map(([Icon, title, text]) => {
        const ToolIcon = Icon as React.ComponentType<{ className?: string }>;
        return <div key={String(title)} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"><ToolIcon className="h-5 w-5" style={{ color: ACCENT }}/><h2 className="mt-1 font-black text-slate-950">{String(title)}</h2><p className="mt-0.5 text-xs leading-4 text-slate-600">{String(text)}</p></div>;
      })}
    </section>

    <section className="grid gap-3 lg:grid-cols-2">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5" style={{ color: ACCENT }}/><h2 className="font-black text-slate-950">O que pode ser reaproveitado</h2></div>
        <div className="mt-2 grid gap-1.5 text-xs text-slate-700 sm:grid-cols-2">
          {['Código-fonte e componentes', 'Migrations e contratos', 'Fluxos e automações', 'Estrutura dos modelos', 'Testes e CI', 'Padrões visuais e de segurança'].map(item => <div key={item} className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2">{item}</div>)}
        </div>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2"><FileKey2 className="h-5 w-5 text-slate-700"/><h2 className="font-black text-slate-950">O que obrigatoriamente deve ser novo</h2></div>
        <div className="mt-2 grid gap-1.5 text-xs text-slate-700 sm:grid-cols-2">
          {['Banco e dados', 'Pasta raiz do Drive', 'OAuth e tokens', 'Segredos de ambiente', 'Conta institucional', 'Administrador Master'].map(item => <div key={item} className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2">{item}</div>)}
        </div>
      </div>
    </section>

    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2"><Workflow className="h-5 w-5" style={{ color: ACCENT }}/><div><h2 className="font-black text-slate-950">Roteiro de implantação</h2><p className="text-xs text-slate-500">Execute na ordem e valide a saída de cada etapa antes de avançar.</p></div></div>
      <div className="mt-3 grid gap-2 lg:grid-cols-2">
        {steps.map(([title, description, output]) => (
          <article key={title} className="flex gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" style={{ color: ACCENT }}/>
            <div><h3 className="text-sm font-black text-slate-900">{title}</h3><p className="mt-0.5 text-xs leading-5 text-slate-600">{description}</p><p className="mt-1 text-[10px] font-black uppercase tracking-wide" style={{ color: ACCENT }}>{output}</p></div>
          </article>
        ))}
      </div>
    </section>

    <section className="grid gap-3 xl:grid-cols-[1.2fr_.8fr]">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-4 py-2.5"><div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" style={{ color: ACCENT }}/><h2 className="font-black text-slate-950">Mapa de isolamento</h2></div></div>
        <div className="divide-y divide-slate-100 text-xs">
          {isolationRows.map(([item, requirement, reason]) => <div key={item} className="grid gap-1 px-4 py-2.5 sm:grid-cols-[1fr_1fr_1.6fr]"><strong className="text-slate-900">{item}</strong><span className="font-semibold" style={{ color: ACCENT }}>{requirement}</span><span className="text-slate-600">{reason}</span></div>)}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
        <div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-slate-700"/><h2 className="font-black text-slate-950">Antes de liberar para uso real</h2></div>
        <div className="mt-2 space-y-1.5">
          {releaseChecks.map(item => <div key={item} className="flex items-start gap-2 text-xs leading-5 text-slate-700"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: ACCENT }}/><span>{item}</span></div>)}
        </div>
        <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3 text-xs leading-5 text-slate-600">
          <div className="flex items-center gap-2 font-black text-slate-900"><Mail className="h-4 w-4"/>Regra operacional</div>
          <p className="mt-1">A replicação copia a plataforma, não a operação da Enfermagem. Dados reais só entram depois da homologação da nova instalação.</p>
        </div>
      </div>
    </section>
  </div>
);
