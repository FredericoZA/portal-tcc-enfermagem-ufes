# Diagnóstico de TCCs legados ausentes — 2026-11-03

## Contexto
O usuário reportou que TCCs legados, supostamente inseridos pelo código de 2026-11-02, não aparecem em "Repositório & Acervo Digital". A tela informa "Nenhum TCC encontrado para os filtros selecionados".

## Evidências verificadas em leitura (sem mutações de dados)
- Deploy de produção Vercel: `dpl_FBWFQXiG7WWuRC9BRJMJtVsCh8D7`, publicado em 2026-11-02 20:49:03 UTC, enviado via CLI com fonte local `work/desenvolvimento-local`. O metadado de SHA referencia `0e392dd4dee31d44ce2d6b12e2ddc21915450fdf`, mas os arquivos enviados ao Vercel divergem do conteúdo da branch `main` correspondente; não usar a branch `main` sem reconciliar a fonte publicada.
- API pública de produção `GET /api/public/repository`: HTTP 200 e corpo `[]` em 2026-11-03.
- API pública para listar processos `GET /api/processes` sem identidade: HTTP 200 e corpo `[]` em 2026-11-03.
- Supabase produção: `public.portal_runtime_state` (`id='global'`) tem `jsonb_array_length(payload->'processes')=0`; `public.portal_processes=0`, `public.portal_publications=0` e `public.portal_files=0` (consulta em 2026-11-03).
- Backups do estado: existem sete snapshots; cinco têm 36 processos. A razão explícita do backup mais recente de 2026-10-22 descreve esses 36 processos como **fictícios de homologação**, criados antes de exclusão deliberada. Eles **não** podem ser tratados como os TCCs legados ou restaurados sobre o estado atual.
- Auditoria operacional no estado atual: ações recentes incluem configurações, acessos e Estúdio; não foi identificada ação de importação de TCCs legados em 2026-11-02.
- Logs Vercel: há falhas transitórias reportadas de carregamento do Supabase (500/timeout) em 2026-11-02. Não foi estabelecida relação causal com a ausência dos legados.

## Diagnóstico
**Confirmado:** o catálogo de processos do backend de produção está vazio; a tela não está apenas escondendo registros por filtro.
**Não confirmado:** se o código de 2026-11-02 continha uma importação ainda não executada, ou se havia uma fonte separada (arquivo, Drive, script, tabela) de registros históricos.
**Não confirmado:** qualquer perda ou exclusão de TCCs legados já cadastrados. Não presumir que os processos fictícios dos backups sejam legados.

## Bloqueio da próxima publicação
1. Recuperar e reconciliar a fonte exata do deploy CLI mais recente com o GitHub; preservar todas as modificações posteriores à branch `main`.
2. Identificar o código e a origem dos TCCs legados alegadamente inseridos em 2026-11-02.
3. Validar contagem, formato, identidade, autorização de publicação e destino de persistência da importação, mantendo os legados separados do fluxo ativo quando apropriado.
4. Reconciliar sem sobrescrever `portal_runtime_state`; não restaurar snapshots de homologação. Validar API, UI, filtros, consulta pública e acesso a arquivos antes de publicar.
5. Preservar o compromisso do usuário: **não publicar no Vercel antes da autorização final**.

Nenhuma mutação nos dados de produção foi executada nesta investigação.
