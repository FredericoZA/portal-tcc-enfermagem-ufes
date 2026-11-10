# Assinaturas: incompatibilidade do banco e confirmação de gravação

## Causa confirmada no banco oficial, somente leitura

A auditoria de produção encontrou violações `portal_signature_signers_signer_role_check`. A consulta do catálogo real confirmou que a constraint aceita `STUDENT`, `ADVISOR` e `COMMISSION_PRESIDENT`, mas não `EXAMINER`. A função instalada `portal_project_runtime_state` mapeia `PRESIDENT` para `COMMISSION_PRESIDENT` e repassa os outros valores. A ata atual tem orientador e dois examinadores: seu primeiro job viola a constraint e aborta toda a transação. O pedido pode ficar persistido como intenção sem job, porque a intenção é salva antes da criação do documento. Não é prova de falha de entrega do Asten.

A correção `supabase/migrations/20261107123138_signature_examiner_role.sql` acrescenta somente o valor normalizado já utilizado pelo fluxo. Não acrescenta papel de acesso, signatário, permissão, RLS, política acadêmica ou chamada ao Asten. O preflight preserva suas 20 tabelas, capacidades, `STABLE`, `SECURITY INVOKER` e search_path; acrescenta apenas `signature_examiner_role_ready`. O diagnóstico Master mostra incompatibilidade e a criação da ata falha antes de renderizar ou criar arquivo se o banco não suporta seus signatários.

A migração tem `lock_timeout=5s` e `statement_timeout=30s`. O rollback em `supabase/rollback/20261107123138_signature_examiner_role.sql` só restaura a constraint antiga se nenhum registro EXAMINER existir. Não apagar signatários válidos para forçar rollback. O novo preflight fica falso ao restaurar a constraint antiga.

O CLI Homebrew Supabase 2.107.0 foi tentado com `migration new --help`, mas seu binário recebeu SIGKILL. Não foram alteradas proteções do Mac nem instaladas ferramentas. Foi usado o nome UTC de 14 dígitos manualmente, sem manter arquivo duplicado.

## Gravação confirmada após perda de ACK

O commit pode chegar ao PostgreSQL e perder sua resposta. Antes, a Promise da fila ficava rejeitada e o middleware podia devolver 503 mesmo com o estado salvo. O cliente Supabase agora faz somente uma leitura canônica completa em casos ambíguos (I/O, resposta de proxy 5xx sem código PostgreSQL, ACK inválido). Não usa cache de revisão ou delta para confirmar o resultado. Só confirma se a revisão é exatamente a CAS esperada + 1 e o payload completo, já compactado/serializado, é estruturalmente igual ao solicitado. Confirma cache e revisão apenas após essa prova. Mismatch, revisão posterior e falha de leitura preservam o erro e a revisão anterior; nunca repetem o POST.

O tratamento existente de timeout SQL 57014 permanece distinto: a transação explicitamente abortada tem uma repetição limitada do mesmo CAS. Não repete Drive, renderização, criação de envelope ou envio. A recuperação residual do modelo público 07 limpa apenas a mesma Promise rejeitada que seu readback confirmou, preservando qualquer fila mais nova.

Na criação de job, erro SQL 23514 explicitamente abortado remove somente o job recém-adicionado da memória. A intenção permanece para a retomada normal após correção. Resultado ambíguo mantém a identidade do job, evitando regeneração com outra chave. Arquivos privados eventualmente produzidos antes de falha continuam preservados, sem afirmação de arquivamento concluído.

## Evidência de código e limites por checklist

- `server/integrations/signatureSignerSchema.test.ts`: PGlite prova constraint antiga falhando e transação sem alterações parciais; migração aceitando a ata; papel desconhecido rejeitado; RPC negada a anônimo; rollback impedido por examinadores válidos.
- `server/integrations/supabaseCommit.test.ts`: ACK perdido, igualdade sem depender de ordem de chaves, auditoria divergente, revisão posterior, leitura falha, ACK malformado, um POST por operação e resolução do helper real da fila. Não confirma sucesso por igualdade parcial.
- `server/signaturePersistencePreflight.test.ts`: preflight falha antes de renderizar; CHECK abortado não deixa job bloquear futuras gravações; intenção preservada; resultado ambíguo mantém identidade.
- `server/automaticSignatureChain.test.ts`: corpo real de `finishArchivedSignature` com gates reais; ata arquivada e termo ainda não arquivado não liberam declaração; depois do termo arquivado e da publicação sincronizada, a declaração é retomada; falha mantém pendência; repetição concluída não dispara; revisão antiga não avança.
- Pacote focado com diagnóstico e modelo público: 15 testes passaram; verificação final registrada no handoff do commit.

Essas provas reforçam T-13/T-14/T-17/T-18/T-24 e 030.02/030.04/030.06/030.T1 no escopo de código e compatibilidade. Não encerram os aceites institucionais T-13/T-24: nenhum TCC real foi processado, nenhum envelope ou e-mail foi enviado e nenhuma assinatura pessoal foi feita por esta frente. A aplicação da migração e o readback oficial são responsabilidade da publicação coordenada pelo root. Não foram criadas rotas, flags ou exceções de fluxo para testar.
