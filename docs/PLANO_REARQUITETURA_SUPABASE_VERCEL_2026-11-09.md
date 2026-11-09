# Reestruturação da persistência e execução do Portal TCC

**Diagnóstico de referência:** 2026-11-09. **Estado:** plano incremental, sem migração destrutiva nem implantação automática.

## Problemas confirmados

- `server.ts`: o middleware `/api` carrega em cada requisição o `payload` global do `portal_runtime_state`, de aproximadamente 4,8 MB de JSON e 914 KB em armazenamento PostgreSQL. Cada partida a frio carrega o snapshot e executava 22 verificações de schema/capability.
- `portal_commit_runtime_state`: um único commit do snapshot executa `portal_project_runtime_state`, `portal_project_runtime_state_v4` e `portal_project_publications_v8`. O PostgreSQL registrou 733 chamadas, média 2,14 s. A projeção faz atualizações repetidas e recria relações de autoria/participação.
- `server/runtimeRequestQueue.ts`: a fila de requisições exclusivas por instância limita concorrência e pode devolver 503 após 5 segundos. Ela existe porque a aplicação mantém estado compartilhado mutável em memória.
- `src/components/PortalLiveSync.tsx`: checava a revisão a cada 15 segundos; usuários inativos mantinham chamadas frequentes.
- `src/pages/MeusProcessosPage.tsx`: falhas de rede eram engolidas e a tela podia exibir "nenhum TCC" sem distinguir lista realmente vazia de indisponibilidade.
- Registros: HTTP 500 por timeout e centenas de mensagens de timeout no PostgREST. A rotina `portal_read_runtime_wire_bytes_v1` transferiu cerca de 773 MB em 180 chamadas na janela observada, devendo-se identificar seus consumidores antes de mudar contratos.

O limite gratuito NÃO permite concluir, sem conhecer tráfego e usuários, que o projeto deveria gastar 5% da cota. O objetivo é reduzir tráfego e latência efetivamente medidos, com uma margem de segurança.

## Etapa 1 — estabilização compatível (PR #183)

Mudanças propostas no código, sem mexer na base de produção:
1. Comparar revisão transacional antes de carregar o snapshot completo, preservando verificação de autorização a cada requisição, falhando fechado se o banco não responder e invalidando o estado após falha de commit.
2. Evitar hidratação duplicada na API de indicadores.
3. Verificar as capabilities no cold start por uma RPC, preservando diagnósticos profundos fora do caminho crítico. Testar separadamente existência do schema antes de publicar.
4. Empacotar somente os bundles necessários em cada função especializada da Vercel, incluindo teste de importação isolada.
5. Reduzir consultas de sincronização em abas ociosas e mostrar erro recuperável em vez de listas falsas vazias.

**Critério de liberação:** CI, smoke de artefatos, revisão de segurança e homologação real de TCC (criação, atualização, reload, acesso cruzado, logout/revogação, assinatura, documentos, concorrência). Nenhum deploy automático.

## Etapa 2 — trocar o agregado global por persistência granular (migrar com dados preservados)

A estrutura atual mantém um único JSONB como fonte operacional. O objetivo é transformar cada TCC em uma unidade independente de leitura e gravação, aproveitando gradualmente as tabelas normalizadas existentes.

**Desenho alvo:**
- `portal_processes` e tabelas auxiliares viram fonte de verdade dos dados cadastrais, status, membros, documentos e permissões. Campos complexos podem usar um JSONB pequeno **por TCC** no período de migração, não um JSON global.
- Uma RPC de escrita transacional por TCC recebe `processId`, `expectedDataRevision`, patch validado, identidade autorizada e uma chave idempotente. Autoriza novamente no servidor/banco, bloqueia apenas o TCC envolvido, aplica mudanças, registra auditoria e devolve revisão confirmada. **Nunca** confirma sucesso antes do COMMIT.
- Duas pessoas editando TCCs diferentes não competem pela mesma revisão global. Duas pessoas editando o mesmo TCC recebem conflito explícito, sem sobrescrever.
- Consultas do usuário acessam somente TCCs autorizados. Relações de membros/permissões usam consultas e índices adequados; detalhes e documentos são buscados sob demanda.
- Requisições públicas consomem projeções públicas minimizadas, nunca o snapshot privado integral.
- Uma revisão por entidade, uma revisão global de invalidação e notificações opcionais substituem polling de grandes conteúdos.
- Arquivos continuam fora do banco operacional, com referências e políticas de acesso privadas. Nunca mover credenciais de serviço para o navegador.

**Migração em degraus:**
1. Backup restaurável e ambiente de homologação com dados anonimizados; inventário de triggers, RLS, retenção, índices e dependências.
2. Criar estrutura complementar e RPCs **aditivas** em migrações versionadas; sem `DROP`, `TRUNCATE` ou revogação de acesso prévio.
3. Backfill em lotes, com validação de hash/contagens e revisão por TCC.
4. Ativar leitura granular por feature flag em homologação; comparar resultados com API legada (sem expor dados pessoais nos logs).
5. Ativar escritas granulares por rotas, com idempotência e proteção de concorrência; manter fallback apenas enquanto comprovadamente seguro.
6. Depois de estabilizar e verificar reversão, aposentar o commit do agregado global. Descartar dados legados somente com retenção/backups aprovados.

**Requisito de consistência:** durante a transição não pode haver dois sistemas de escrita independentes que permitam divergência. Escritas duplas precisam ser uma transação única no banco, ou não devem ser habilitadas.

## Etapa 3 — capacidade, custo e monitoramento

- Vercel: medir tamanho de artefatos por função, cold starts, latências P50/P95/P99, HTTP 429/503/5xx, tempo de CPU e número de invocações por rota. Consolidar os endpoints simples e separar arquivos/relatórios pesados.
- Supabase: medir egress por endpoint, leituras integrais por minuto, chamadas e tempo de `portal_commit_runtime_state`, linhas atualizadas por tabela e componentes da ingestão de logs; manter logs de segurança, mas retirar depuração desnecessária quando identificada.
- Publicações: apenas após smoke e possibilidade de rollback. Não apagar deployments antigos ou dados do banco para economizar espaço sem verificar implicações de recuperação.
- Acesso: `service_role` permanece exclusivo do servidor; RLS revisada para cada tabela exposta. Backup e restauração verificados antes de qualquer migração.
- Medir semanalmente contra baseline equivalente, considerando usuários ativos e intensidade do uso; não atribuir mudança de custo sem normalizar pelo volume de atividade.

## Critérios de aceite de negócio

- Salvamento de TCC confirma no banco antes de exibir sucesso e não desaparece após recarregar.
- Uma falha transitória não faz a interface informar incorretamente que o TCC não existe.
- Duas edições simultâneas em TCCs diferentes não bloqueiam uma à outra.
- Conflito no mesmo TCC é explícito, não silencioso.
- Revogação de acesso não permite visualizar conteúdo privado de outra identidade.
- Queda temporária do banco não altera dados nem dispara repetição de gravação ambígua.
- Consumo de CPU, invocações, egress e logs cai de forma demonstrável no tráfego comparável.

## Limitações atuais

A Etapa 1 reduz redundância, mas **não remove** o estado global, a serialização exclusiva ou o custo de projeção por commit. O redesenho transacional da Etapa 2 depende de banco de homologação e backup comprovadamente restaurável antes de mudar esquema e rotinas de produção.
