import React from 'react';
import {
  BookOpenCheck,
  CalendarCheck,
  CheckCircle2,
  FileSignature,
  GraduationCap,
  SearchCheck,
  UserCheck,
  Users,
} from 'lucide-react';
import { ColorfulHeaderIcon } from '../components/ColorfulHeaderIcon';
import { PortalSectionDivider } from '../components/PortalSectionDivider';
import { SignatureFlowSummary } from '../components/SignatureFlowSummary';

const phases = [
  {
    n: 1,
    title: 'Cadastrar o trabalho',
    actor: 'Aluno',
    icon: GraduationCap,
    where: 'Meus TCCs → Cadastrar TCC',
    summary: 'Entre com seu e-mail autorizado e preencha as sete etapas do formulário.',
    details: [
      'Informe os autores, os docentes, a banca e os dados do trabalho. O e-mail do primeiro autor é o do acesso utilizado.',
      'Na última etapa, escolha um local, uma data e um horário. Confira a tabela com os dados antes de usar Cadastrar e solicitar reserva.',
      'Para continuar depois, use Salvar e sair. Os dados também são salvos ao avançar ou voltar uma etapa.',
    ],
    gate: 'Formulário conferido, sem erros de preenchimento ou conflito de horário no local escolhido.',
    result: 'Protocolo criado e pedido de reserva encaminhado ao responsável.',
  },
  {
    n: 2,
    title: 'Homologar a reserva',
    actor: 'Departamento ou orientador',
    icon: CalendarCheck,
    where: 'E-mail do responsável → Aceitar reserva ou Recusar reserva',
    summary: 'O responsável decide sobre o local, a data e o horário solicitados.',
    details: [
      'Antes do pedido, alunos e orientador podem conferir mapa de salas, aulas, eventos, reservas e horários do prédio. Em caso de dúvida, a consulta ao departamento evita retrabalho.',
      'O departamento homologa auditório e sala de reuniões. Outro local é confirmado pelo orientador, que viabiliza a reserva junto ao espaço escolhido.',
      'O pedido bloqueia apenas o local selecionado durante o intervalo da defesa, de 1h30. A recusa libera esse intervalo; o Portal não controla reservas externas.',
      'Enquanto aguarda resposta, o agendamento aparece em vermelho no Calendário, com (aguardando confirmação) após o horário. O aceite retira o aviso; a recusa retira o agendamento e mantém o código do TCC.',
      'Autores e orientador recebem o resultado. Para corrigir o agendamento, um dos autores usa Alterar reserva em Dados do processo ou Refazer reserva após uma recusa. O novo pedido exige outro aceite.',
    ],
    gate: 'Aceite do responsável registrado para a data, o horário e o local atuais.',
    result: 'Reserva confirmada e comprovante disponível em Documentos administrativos.',
  },
  {
    n: 3,
    title: 'Comunicar a banca',
    actor: 'Portal',
    icon: Users,
    where: 'Calendário e Documentos administrativos → Carta-Convite da Banca',
    summary: 'Com o local confirmado, o Portal prepara a carta-convite e comunica a defesa.',
    details: [
      'Os examinadores e o coorientador, quando houver, recebem o convite em uma mensagem de grupo, com autores e orientador em cópia.',
      'O link do TCC abre os documentos administrativos. A carta-convite é consultada no Portal; nenhum PDF é anexado ao e-mail de convite.',
      'Confira a defesa no Calendário. Dados públicos podem ser consultados sem login; ações e informações restritas dependem do acesso do participante.',
    ],
    gate: 'Local confirmado e convite emitido para a composição atual da banca.',
    result: 'Banca comunicada e informações da defesa disponíveis para consulta.',
  },
  {
    n: 4,
    title: 'Registrar conceito e ata',
    actor: 'Orientador',
    icon: SearchCheck,
    where: 'Meus TCCs → TCC → Conceito e Ata',
    summary: 'A partir do horário da defesa, registre o conceito e o parecer para a documentação.',
    details: [
      'Registre o conceito deliberado pela banca: Aprovado, Aprovado com ressalva ou Reprovado. Registre as ressalvas no parecer, quando houver. O docente lança notas e frequência no Portal do Professor, em professor.ufes.br.',
      'Clique em Visualizar ata, confira a prévia e confirme a conferência. Use Registrar conceito e ata e ir para documentos.',
      'Em Documentos administrativos, escolha Asten ou Gov.br na caixa da ata. Orientador e dois examinadores assinam a mesma ata; registrar o conceito não solicita assinatura automaticamente.',
    ],
    gate: 'Ata assinada pelo orientador e pelos dois examinadores e arquivada; escolher um método ou enviar um PDF ainda não conclui a assinatura.',
    result: 'Entrega final liberada aos autores, com aviso também ao orientador.',
  },
  {
    n: 5,
    title: 'Confirmar a entrega final',
    actor: 'Qualquer um dos autores',
    icon: BookOpenCheck,
    where: 'TCC → Repositório acadêmico',
    summary: 'Preencha os metadados e envie os arquivos finais após o arquivamento da ata assinada.',
    details: [
      'Informe o resumo e exatamente cinco palavras-chave. Anexe o PDF final do TCC, obrigatório para os trabalhos novos. O resumo expandido é opcional.',
      'Escolha separadamente se autoriza publicar o trabalho completo, o resumo expandido, ambos ou nenhum. Entregar o TCC não significa autorizar sua publicação.',
      'Use Confirmar entrega e ir para documentos. Os campos ficam bloqueados; Editar entrega permite corrigir enquanto a etapa estiver aberta e pode exigir novas assinaturas.',
    ],
    gate: 'Arquivo obrigatório, resumo, palavras-chave e escolhas de publicação registrados.',
    result: 'Entrega confirmada e continuidade em Documentos administrativos.',
  },
  {
    n: 6,
    title: 'Assinar o termo de autorização',
    actor: 'Todos os autores e orientador',
    icon: FileSignature,
    where: 'Documentos administrativos → Termo de Autorização e Publicação',
    summary: 'O termo existe somente quando pelo menos um arquivo foi escolhido para publicação.',
    details: [
      'Sem publicação autorizada, esta assinatura não se aplica. O Portal prossegue sem gerar um termo vazio.',
      'Na caixa do termo, escolha Asten ou Gov.br. Todos os autores e o orientador assinam o mesmo documento; no Asten, as assinaturas têm o mesmo nível.',
      'Pelo Gov.br, o orientador reúne todas as assinaturas no mesmo PDF, assina por último e devolve o arquivo completo. O Master registra a conferência antes do arquivamento.',
    ],
    gate: 'Termo assinado e arquivado, quando houver publicação autorizada.',
    result: 'Quando houver publicação autorizada, o arquivamento do termo libera a etapa da declaração da banca.',
  },
  {
    n: 7,
    title: 'Assinar a declaração',
    actor: 'Presidente da Comissão',
    icon: UserCheck,
    where: 'Área do Presidente → declaração do TCC → Asten ou Gov.br',
    summary: 'A presidência da comissão assina a declaração de participação na banca.',
    details: [
      'A declaração depende da entrega final, da ata arquivada e do termo assinado e arquivado, quando aplicável.',
      'A presidência da comissão assina a declaração; o orientador preside a sessão e assina a ata com os dois examinadores. São responsabilidades diferentes.',
      'Pelo Asten, solicite e siga o e-mail de assinatura. Pelo Gov.br, baixe, assine e devolva o PDF; a conferência administrativa ainda é necessária.',
    ],
    gate: 'Declaração assinada e arquivada, sem pendências obrigatórias.',
    result: 'Documentação final pronta para o encerramento do processo.',
  },
  {
    n: 8,
    title: 'Concluir e consultar',
    actor: 'Portal e participantes',
    icon: CheckCircle2,
    where: 'TCC → Documentos administrativos e Repositório acadêmico',
    summary: 'O Portal conclui o processo após o arquivamento dos documentos obrigatórios.',
    details: [
      'Autores, orientador, banca e presidência recebem o aviso final. Os documentos disponíveis podem ser consultados por Ver e Baixar PDF.',
      'A consulta pública não exige login. E-mails, matrículas e outros registros pessoais permanecem restritos; os arquivos acadêmicos dependem da autorização de publicação.',
      'Após a assinatura da declaração ou a conclusão, a entrega não pode mais ser editada. O histórico permanece vinculado ao protocolo.',
    ],
    gate: 'Nenhuma entrega, assinatura ou conferência obrigatória pendente.',
    result: 'Etapa Concluído, com os arquivos liberados conforme as permissões de cada pessoa.',
  },
] as const;

export const FluxoTccPage: React.FC = () => (
  <div id="fluxo-tcc-page" className="mx-auto max-w-none space-y-0">
    <section className="portal-public-header">
      <div className="portal-public-title-row gap-2">
        <ColorfulHeaderIcon type="flow" />
        <h1 className="text-sm font-black normal-case tracking-tight text-white sm:text-base">Fluxo do TCC</h1>
      </div>
    </section>
    <PortalSectionDivider />

    <section className="portal-layer-panel p-3 sm:p-5">
      <h2 className="mb-2 text-sm font-bold text-slate-950">Passos do processo</h2>
      <p className="mb-5 text-xs leading-5 text-slate-700">Os passos abaixo mostram quem faz cada ação. Na ficha do TCC, o indicador acompanha as etapas Cadastro, Agendamento, Convite e Banca, Defesa, Conceito e Ata, Assinaturas, Documentos e Concluído. Ele avança conforme os registros e arquivamentos; apenas selecionar um método de assinatura não conclui a etapa.</p>
      <div className="portal-flow-snake" aria-label="Passos para concluir o TCC">
        {phases.map(({ n, title, actor, icon: Icon, where, summary, details, gate, result }) => (
          <article key={n} className="portal-flow-step portal-layer-card flex h-full flex-col rounded-2xl border border-slate-300 p-4 shadow-sm">
            <div className="portal-flow-number flex h-11 w-11 items-center justify-center rounded-full border-4 border-[var(--portal-surface-panel)] bg-[var(--portal-brand-header)] text-sm font-black text-white shadow-md" aria-label={`Passo ${n}`}>
              {n}
            </div>

            <div className="flex min-h-[48px] items-start gap-3 pl-7">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--portal-brand-action)] text-white shadow-sm" aria-hidden="true">
                <Icon className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-sm font-black text-slate-950 sm:text-base">{title}</h2>
                  <span className="rounded-full border border-slate-300 bg-[#eef1f3] px-2 py-1 text-[8.5px] font-black normal-case tracking-wide text-slate-700">{actor}</span>
                </div>
                <span className="mt-1 inline-block text-[8.5px] font-black normal-case tracking-[0.16em] text-[var(--portal-brand-action)]">Passo {n}</span>
              </div>
            </div>

            <p className="mt-3 text-xs leading-5 text-slate-700">{summary}</p>
            <p className="mt-2 rounded-lg bg-[var(--portal-surface-panel)] px-2.5 py-2 text-[11px] leading-4.5 text-slate-800"><strong>Onde agir:</strong> {where}</p>

            <div className="mt-3 flex-1 space-y-1.5">
              {details.map((detail) => (
                <div key={detail} className="flex gap-2 text-[11px] leading-4.5 text-slate-700">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--portal-brand-action)]" aria-hidden="true" />
                  <span>{detail}</span>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-xl border border-[var(--portal-border)] bg-[var(--portal-surface-panel)] px-3 py-2 text-[10.5px] leading-4 text-slate-700">
              <strong className="text-slate-900">Para avançar:</strong> {gate}
            </div>

            <div className="mt-2 flex min-h-[58px] items-start gap-2 rounded-xl border border-[var(--portal-border)] bg-[var(--portal-surface-inner)] px-3 py-2 text-[10.5px] font-semibold leading-4 text-slate-700">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--portal-brand-action)]" />
              <span><strong className="text-slate-900">Resultado:</strong> {result}</span>
            </div>
          </article>
        ))}
      </div>
    </section>
    <div className="space-y-3 px-3 pb-3 sm:px-5 sm:pb-5">
      <SignatureFlowSummary />
    </div>
  </div>
);
