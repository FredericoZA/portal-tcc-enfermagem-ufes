import React,{useId} from 'react';
import {CalendarDays} from 'lucide-react';

/** A prior consultation is guidance, not a second approval or a new form field. */
export function ReservationSchedulingNotice(){
 const titleId=useId();
 return <aside role="note" aria-labelledby={titleId} className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950 sm:p-5">
  <h2 id={titleId} className="flex items-center gap-2 text-base font-bold"><CalendarDays className="h-5 w-5 shrink-0" aria-hidden="true"/>Antes de solicitar o agendamento</h2>
  <ul className="mt-2 list-disc space-y-2 pl-5 text-sm leading-6">
   <li><strong>Locais do departamento:</strong> O Auditório de Enfermagem e a Sala de Reuniões são usados para aulas e outras atividades. Se necessário, alunos e orientador podem consultar o Departamento de Enfermagem antes de enviar o pedido, para evitar retrabalho. A reserva depende da homologação do departamento.</li>
   <li><strong>Defesa em outros locais:</strong> Se a defesa ocorrer em um local diferente dos padrões, digite o nome completo do espaço exatamente como deseja que apareça nos documentos. Nesses casos, o próprio orientador receberá a notificação para aceitar ou recusar o agendamento, ficando responsável por garantir a reserva junto ao local escolhido.</li>
   <li><strong>Bloqueio temporário:</strong> Ao enviar o pedido, o sistema bloqueia o local no intervalo da defesa (1h30). O aceite mantém a reserva; a recusa libera o horário. Os locais padrão cadastrados são o Auditório de Enfermagem e a Sala de Reuniões. O bloqueio considera somente as defesas registradas neste Portal e não consulta as agendas dos espaços. Em outros locais, pode haver conflito com aulas, eventos ou reservas que não aparecem aqui. Confirme a disponibilidade com o orientador e com o responsável pelo espaço.</li>
  </ul>
 </aside>;
}
