# Rascunho com commit específico

O PUT do rascunho mantém a autorização atual, a fila exclusiva, a revisão do formulário e a revisão otimista do rascunho. A nova RPC recebe somente o rascunho validado e a revisão global confirmada; modifica apenas `registrationDrafts[owner]`, mantém os demais campos e incrementa a revisão global e seu registro de hash. Não executa as projeções de processos, assinaturas ou publicações. O JSON agregado ainda é atualizado internamente pelo PostgreSQL; esta mudança reduz o transporte de dados e elimina projeções desnecessárias, sem prometer uma duração ou capacidade de usuários não medida.

A RPC é `SECURITY INVOKER`, concedida somente a `service_role`; nenhuma RLS ou permissão do Portal é removida. O servidor deriva o proprietário da sessão. O adaptador usa o cache canônico confirmado, nunca o agregado mutável do chamador; publica a revisão no cache somente após ACK válido ou readback da revisão seguinte e do payload completo exato. Falha ou resposta ambígua não provoca repetição cega do POST. A rota só instala o rascunho em memória após confirmação. A fila de persistência existente continua observável pelo middleware que confirma as respostas.

Compatibilidade: `local_file` conserva sua persistência existente. Uma resposta definitiva `404/PGRST202` para a RPC ausente usa o commit agregado anterior; nenhuma falha de rede, permissão ou concorrência ativa esse fallback. A migration foi instalada no projeto oficial em 07/11/2026, versão 20261107191835; a nova versão da aplicação precisa estar publicada para usar a gravação específica.

## Evidência de infraestrutura e preparação

Em consulta somente de metadados ao projeto oficial em 07/11/2026, `pg_get_functiondef(portal_commit_runtime_state)` confirmou as três projeções, o hash agregado e o conflito `PT409`; `portal_runtime_state` possui RLS e `service_role` tem SELECT/UPDATE na tabela e INSERT em `portal_runtime_commits`. A instalação da função específica foi confirmada: SECURITY INVOKER, EXECUTE somente para service_role, RLS da tabela preservada e ausência de chamadas às projeções completas.

Foram lidos o índice atual `https://supabase.com/changelog.md` e a documentação `https://supabase.com/docs/guides/database/functions`. A alteração de PostgreSQL 17.11 listada no índice aborda índices/operadores e cifras legadas; este candidato usa JSONB, CAS e SHA-256 existentes, sem cifras ou índices novos.

O comando instalado `supabase migration new registration_draft_scoped_commit` e até `supabase --help` terminaram com SIGKILL no binário local. Sem alterar ferramentas globais, o arquivo local `20261107191835_registration_draft_scoped_commit.sql` foi criado manualmente como exceção explícita autorizada pelo responsável pela integração. O arquivo foi alinhado à versão 20261107191835 registrada na aplicação via MCP Supabase; o CLI global não foi alterado.

## Verificação

Os testes de banco executam a migration local em PGlite com pgcrypto: preservação dos demais dados e outros alunos, conflito global e de duas abas, mudança do schema, identidade, hash/revisão e revogação de acesso à função para anon/authenticated. Não existem funções de projeção no fixture; sua chamada indevida faria o teste falhar.

Os testes do adaptador incluem agregado de um megabyte e POST menor que um quilobyte, isolamento do cache, ACK perdido sem repetir POST, mismatch, falha no readback, conflito, permissão e RPC ausente. Os testes da rota exercitam a função real com ACK pendente, falha, fallback, `local_file` e revisão do formulário. A confirmação de desempenho real depende da publicação do cliente/servidor e de medições posteriores; não foi inferida dos testes.
