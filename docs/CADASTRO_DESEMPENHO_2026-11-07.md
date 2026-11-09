# Navegação e salvamento do cadastro — 07/11/2026

O usuário relatou melhora parcial, sem confirmar resolução completa. Esta rodada
preserva o salvamento confirmado antes de avançar, o controle de concorrência,
as permissões e todas as etapas do processo. Não cria TCC, reserva, convite ou
assinatura de teste em produção.

## Mudanças

- A leitura incremental do estado reutiliza uma projeção transacional dos blocos
  da auditoria corrente. Fronteiras e hashes deixam de ser recalculados em cada
  leitura. O trigger só recalcula quando a auditoria muda e só regrava blocos
  alterados. O contrato da RPC e a ordem/conteúdo dos registros são preservados.
- A projeção é restrita ao backend, com RLS forçado e funções SECURITY INVOKER.
  Limites de 16 MiB/5.000 blocos remetem à implementação anterior integral, sem
  truncamento. Documentos continuam no Drive; a projeção não guarda arquivos.
- Bootstrap e PUT do rascunho medem fila, espera de escritas anteriores,
  hidratação, aplicação do estado e commit. Server-Timing e logs contêm apenas
  rota fixa, status e durações; nenhum nome, e-mail, resposta ou credencial.
  O total medido começa depois do parser HTTP, sem incluir rede/cold start.

## Evidências e limites

O ensaio local com auditoria sintética de 2,45 MB mediu leitura conhecida em
41,73 → 11,47 ms e leitura fria em 81,75 → 36,40 ms. O UPDATE só de rascunho
passou de 37,17 → 43,27 ms; alterando a auditoria, 32,11 → 74,38 ms. Há custo
adicional de escrita em troca de eliminar o processamento repetido nas leituras.
São medianas locais PGlite, não latência do navegador ou garantia de produção.

A migração oficial instalada é `20261107194035`. A comparação somente de leitura
no banco oficial confirmou igualdade de revisão, payload e blocos, tanto fria
quanto com todos os blocos conhecidos. EXPLAIN ANALYZE da consulta conhecida:
implementação anterior 180,462 ms; projeção 60,132 ms. Na leitura fria, a amostra
anterior foi 326,210 ms e a posterior 143,082 ms. São amostras de execução SQL,
sem rede/navegador. A porção de auditoria conhecida manteve 765 bytes em ambas
as implementações, preservando a economia de tráfego já existente.

Leitura de volta confirmou RLS forçado, funções invoker e SELECT/EXECUTE negados
a anon/authenticated. Os dois novos avisos INFO de RLS sem policy correspondem
à negação intencional de acesso dessas tabelas internas; service_role conserva
o acesso. Não foi criada uma política permissiva para silenciar o aviso.
Referência: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy

Os logs pós-publicação anterior (e942d7e, 19:23–19:32 UTC) não mostraram PUT de
rascunho. Mostraram um commit agregado de 12,4 s no serviço de origem. Não há
correlação suficiente para atribuí-lo ao clique relatado. O Master já usava
salvamento local intermediário; essa regra não foi alterada nesta rodada.

A revisão independente não encontrou bloqueadores. Os testes específicos
conferem paridade, ACL/RLS, rollback, CAS, limites e preservação física de blocos
inalterados. O comprovante de publicação registra o resultado final dos checks,
a revisão instalada e as medições SQL oficiais antes/depois. A navegação real
continua sendo acompanhada pelo feedback do usuário; não está marcada como
100% resolvida por um benchmark isolado.
