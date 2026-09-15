import React from 'react';
import {
  ArrowRight,
  BookOpenCheck,
  CalendarCheck,
  CheckCircle2,
  FileSignature,
  GitBranch,
  GraduationCap,
  SearchCheck,
  UserCheck,
  Users,
} from 'lucide-react';

const phases = [
  { n: 1, title: 'Cadastro inicial', actor: 'Aluno', icon: GraduationCap, text: 'Cadastra o TCC, participantes, título e data/horário pretendidos.' },
  { n: 2, title: 'Confirmação do local', actor: 'Aluno + Departamento', icon: CalendarCheck, text: 'Confere a reserva e registra o local definitivo da apresentação.' },
  { n: 3, title: 'Convite e calendário', actor: 'Portal', icon: Users, text: 'Registra a defesa no calendário e prepara o convite institucional.' },
  { n: 4, title: 'Defesa e Ata', actor: 'Orientador', icon: SearchCheck, text: 'Registra resultado e parecer e confere os dados da Ata.' },
  { n: 5, title: 'Entrega final', actor: 'Aluno', icon: BookOpenCheck, text: 'Envia o trabalho final, palavras-chave e os resumos aplicáveis.' },
  { n: 6, title: 'Termo de autorização', actor: 'Aluno(s) + Orientador', icon: FileSignature, text: 'Confere e encaminha o Termo para assinatura quando aplicável.' },
  { n: 7, title: 'Declaração da banca', actor: 'Presidente', icon: UserCheck, text: 'Confere e encaminha a declaração de participação da banca.' },
  { n: 8, title: 'Conclusão', actor: 'Portal', icon: CheckCircle2, text: 'Encerra o processo após as etapas e assinaturas exigidas.' },
] as const;

export const FluxoTccPage: React.FC = () => (
  <div id="fluxo-tcc-page" className="mx-auto max-w-5xl space-y-3 py-2">
    <section className="rounded-2xl border border-emerald-900/80 bg-[#005830] px-3.5 py-3 text-white shadow-sm sm:px-4">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-300 bg-white shadow-2xs" aria-hidden="true">
          <GitBranch className="h-4 w-4 text-slate-700" />
        </span>
        <h1 className="text-sm font-black uppercase tracking-tight text-white sm:text-base">Fluxo completo do TCC</h1>
      </div>
    </section>

    <section className="rounded-2xl border border-slate-300 bg-[#f0f0f0] p-3 shadow-sm sm:p-4">
      <div className="grid gap-2 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-center shadow-2xs">
          <div className="text-2xl font-black text-[#337959]">8</div>
          <div className="text-[10px] font-black uppercase tracking-wide text-slate-700">Etapas</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-center shadow-2xs">
          <div className="text-2xl font-black text-[#337959]">5</div>
          <div className="text-[10px] font-black uppercase tracking-wide text-slate-700">Papéis principais</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-center shadow-2xs">
          <div className="text-2xl font-black text-[#337959]">1</div>
          <div className="text-[10px] font-black uppercase tracking-wide text-slate-700">Processo contínuo</div>
        </div>
      </div>
    </section>

    <section className="rounded-2xl border border-slate-300 bg-[#f0f0f0] p-3 shadow-sm sm:p-4">
      <div className="grid gap-2 lg:grid-cols-4">
        {phases.map(({ n, title, actor, icon: Icon, text }, index) => (
          <React.Fragment key={n}>
            <article className="relative rounded-xl border border-slate-200 bg-white p-3 shadow-2xs">
              <div className="flex items-center justify-between gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#337959] text-white shadow-sm"><Icon className="h-5 w-5" /></span>
                <span className="rounded-full border border-slate-300 bg-[#e5e9ed] px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-slate-700">Etapa {n}</span>
              </div>
              <h2 className="mt-2 text-sm font-black text-slate-950">{title}</h2>
              <div className="mt-1 inline-flex rounded-full bg-[#e5e9ed] px-2 py-1 text-[9px] font-black uppercase tracking-wide text-slate-700">{actor}</div>
              <p className="mt-2 text-xs leading-5 text-slate-600">{text}</p>
              {index < phases.length - 1 && (
                <span className="pointer-events-none absolute -right-3 top-1/2 z-10 hidden -translate-y-1/2 items-center justify-center rounded-full border border-slate-300 bg-white p-1 text-[#337959] shadow-sm lg:flex" aria-hidden="true">
                  <ArrowRight className="h-3.5 w-3.5" />
                </span>
              )}
            </article>
          </React.Fragment>
        ))}
      </div>
    </section>

    <section className="rounded-2xl border border-slate-300 bg-[#f0f0f0] p-3 shadow-sm sm:p-4">
      <div className="flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-wide text-slate-700">
        {['Aluno', 'Departamento', 'Portal', 'Orientador', 'Presidente'].map((role) => (
          <span key={role} className="rounded-full border border-slate-300 bg-white px-3 py-1.5 shadow-2xs">{role}</span>
        ))}
      </div>
    </section>
  </div>
);
