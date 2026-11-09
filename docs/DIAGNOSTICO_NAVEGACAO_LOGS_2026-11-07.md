# Navegação e falha no registro de logs — 07/11/2026

Relato: navegação intermitente, captura de Registro de Logs com aviso de falha e tabela vazia. Não há horário da captura suficiente para vincular aquele clique a um requestId específico.

## Evidência real, somente leitura

Janela Supabase: 07/11/2026, 16:42–16:58 UTC (13:42–13:58 Brasília). Consultas agregadas dos logs oficiais, sem exportar registros acadêmicos ou segredos.

- GET portal_runtime_state com revisão: 287 respostas 200, média 390 ms de origin_time.
- GET snapshot completo: 15 respostas 200, média 4.578,7 ms; nove respostas 500, média 13.887,9 ms.
- PostgreSQL: 23 mensagens de statement timeout. Não somar esse total aos erros HTTP: podem representar os mesmos eventos.
- RPC commit: 11 respostas 200, média 7.646,36 ms; duas respostas 500. A RPC de snapshot apresentou também uma resposta 500.
- Vercel: falhas de CREATE_APP / SUPABASE_RUNTIME_STATE_ERROR em duas versões candidatas recentes. O sinal original do banco estava sendo perdido pelo encapsulamento do erro. Os caminhos registrados incluíam settings/me/processes/calendar. Isso não identifica qual dessas requisições corresponde à captura de logs.
- Consulta pontual de pg_stat_activity: uma sessão ativa (a consulta), nenhuma espera de lock observada naquele instante. Advisor health sem avisos. Esse instante não exclui contenção anterior nem prova capacidade para 60 usuários.

O código confirma outra causa de indisponibilidade: fila FIFO por instância, com espera máxima de cinco segundos. A posse permanece até tarefas registradas de reserva/ASTEN terminarem, mesmo após resposta 202. Remover essa posse prematuramente permitiria que outra leitura substituísse objetos globais ainda em gravação. A proteção permanece.

O banco não está comprovadamente cheio. Os sintomas desta janela são cancelamentos por tempo de consulta e lentidão de snapshot/commit. Há ainda um agregado operacional com histórico e configurações que torna as leituras completas caras; guardar PDFs no Drive não elimina esse custo de metadados. Não houve upload, migração de arquivos, modificação de dados acadêmicos nem mudança de configuração global do banco nesta rodada.

## Correções desta rodada

1. Falha no carregamento de logs tem estado explícito e ação de tentar novamente. Lista vazia e contagem zero só aparecem após leitura bem-sucedida.
2. Uma espera transitória da fila permite apenas uma nova tentativa do GET, respeitando Retry-After e cancelamento. Sem repetição automática de gravações, 401/403 ou erro genérico do banco.
3. Resultados, seleção e cursores pertencem à conta/filtro/requisição atuais; respostas antigas são ignoradas.
4. Paginação sem busca seleciona a página antes de copiar/sanitizar detalhes grandes. Busca e formato da resposta são preservados. Fixture com 5.000 registros: caminho completo 577–621 ms; paginado 14–16 ms, JSON idêntico. Ganho sintético de CPU/alocação, não economia de banda ou prova de desempenho real.
5. Erros de leitura preservam apenas SQLSTATE/etapa/status seguros; inicialização e hidratação distinguem a falha sem imprimir resposta privada. Hidratação continua recusando acesso se a autorização atual não for confirmada.

## Limites e acompanhamento

A falha de produção no snapshot não está encerrada por essas alterações. O próximo diagnóstico deve usar os sinais seguros para medir a consulta e o tempo sob concorrência, e reduzir o agregado com preservação da transação/CAS e da restauração de estado após gravação falha. Não basta aumentar timeouts, afrouxar permissões, devolver autorização antiga ou repetir operações de envio.

MAN-005 acompanha este incidente. As caixas amplas dos dois checklists continuam abertas enquanto faltarem as respectivas evidências. A publicação e a validação desta rodada constam no comprovante separado em output/revisao-2026-11-07.

Documentação consultada: https://supabase.com/docs/guides/database/postgres/timeouts e https://supabase.com/docs/guides/observability/log-slow-queries.
