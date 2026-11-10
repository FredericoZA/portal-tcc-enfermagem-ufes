# Calendário por local e limites do controle de reservas

Solicitação do responsável em 07/11/2026, captura codex-clipboard-f1e0ea0f-0b10-4520-a4e6-437d7b2e1290.png.

MAN-009: aviso de bloqueio temporário explica que auditório e sala de reuniões são os locais padrão cadastrados; o controle considera somente defesas registradas no Portal, não consulta agendas externas, e outros locais podem ter aulas, eventos ou reservas não exibidos. Orientador e responsável pelo espaço devem conferir a disponibilidade. Nenhuma regra de bloqueio/aceite, destinatário ou etapa foi alterada.

MAN-010: novo controle Locais no cabeçalho do calendário, com Todos os locais, Limpar, seleção múltipla e Concluir. Opções derivadas dos locais do departamento e das defesas/eventos já carregados, incluindo nomes informados na terceira opção. Sem novas chamadas de API para obter ou selecionar locais. O padrão Todos inclui locais que cheguem em atualização posterior; a seleção vazia é explícita.

A seleção filtra a grade, a lista de defesas e os detalhes do dia. O Repositório permanece independente. Deduplicação Google compara todos os processos antes do filtro, para uma cópia antiga não reaparecer ao ocultar o processo atual. Locais sem informação têm opção explícita; salas diferentes não são agrupadas por aproximação do nome.

O seletor abre em portal no body para não ser recortado pelo contêiner do calendário. Lista com rolagem limitada, teclado/foco acessíveis e fechamento por clique/foco fora, Escape, redimensionamento ou rolagem externa. A rolagem dentro da lista não fecha o seletor.

Opções, seleção e detalhes são associados à identidade atual. A carga inicial e atualização live compartilham um controller: uma resposta antiga não substitui a nova, inclusive após trocar conta, e a operação atual termina o carregamento também em falha. Essas mudanças não ampliam permissões nem guardam dados de outra conta em cache persistente.

As verificações e a publicação constam em output/revisao-2026-11-07/CALENDARIO_LOCAIS_PUBLICACAO.json. Não se criou reserva, mensagem, documento, assinatura ou dado de teste em produção. O filtro mostra defesas e não constitui garantia de disponibilidade de um espaço.
