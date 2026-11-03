# Cadastro após exclusões pendentes

Os logs PostgreSQL registraram SQLSTATE 23505 durante a projeção transacional de um novo cadastro em `portal_processes`. A lista principal não tinha processos ativos, mas os códigos TCC-2026-0001 e TCC-2026-0002 ainda pertenciam a registros cancelados aguardando limpeza. O cálculo considerava apenas processos ativos e tentava reutilizar 0001.

A numeração passa a considerar também os protocolos das tarefas de exclusão pendentes. O teste de regressão cobre a lista ativa vazia com 0001/0002 em limpeza, uma sequência ativa e pendente combinada e prefixos/anos diferentes. Esta correção não remove a restrição de unicidade do banco.

Os textos de ajuda dos nomes foram reduzidos, com uma instrução comum aos dois autores. O ajuste automático de capitalização permanece. O aviso de consulta prévia à secretaria foi encurtado.

Publicado no deployment `dpl_EiYJpUF3wRGzLQc5QqBG6jFT1Esb`. Não foi criado um processo real de teste nem enviado pedido real de reserva nesta verificação. A limpeza definitiva dos envelopes Asten permanece pendente da documentação autenticada do provedor.
