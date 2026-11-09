# Portal TCC — Política de arquitetura, segurança e consumo de recursos

**Versão:** 1.0 (09/11/2026)  
**Natureza:** norma técnica para novos desenvolvimentos e refatorações; não significa que todos os itens já estejam implementados.  
**Plataformas:** navegador (React/Vite), API em Vercel, PostgreSQL/Supabase, Google Drive/Workspace, autenticação de sessão do Portal e provedores de assinatura.

## 1. Hierarquia de princípios

1. **Integridade e controle de acesso antes de economia:** não mostrar informações de outro perfil, perder documentos, inventar sucesso, sobrescrever alterações concorrentes, reutilizar permissões revogadas nem divulgar token privilegiado.
2. **Transação pequena e verificável:** a operação deve alterar o menor conjunto de linhas necessário, com revisão da entidade, idempotência, auditoria e confirmação persistida.
3. **Leitura proporcional à tela:** projetar somente campos requeridos, paginar listas, não transmitir histórico e configurações administrativas a toda requisição.
4. **Atualização precisa:** eventos e revisões por entidade; sincronização adaptativa; falha de consulta não equivale à ausência de TCC.
5. **Custos verificáveis:** medir bytes, requisições, banco, função, latência, cold starts, logs, downloads e consumo por ação/usuário ativo.
6. **Evolução reversível:** mudanças aditivas, compatibilidade entre versões, backups restauráveis e testes de paridade antes de desativar dados legados.

## 2. Situação factual observada em 09/11/2026

- O banco de produção contém estado global JSONB de aproximadamente **4,78 MB em texto**, com apenas **~7 KB** de processos. Seus principais componentes são auditoria (~3,01 MB), acervo legado (~895 KB) e versões do estúdio (~593 KB).
- Em `pg_stat_statements`: a leitura de `portal_runtime_state.payload` ocorreu aproximadamente 7.506 vezes com ~392 ms médios; o `portal_commit_runtime_state` ocorreu aproximadamente 740 vezes com ~2,16 s médios. Estatísticas acumuladas, não um benchmark de carga controlada.
- A função `portal_commit_runtime_state` executa três projeções normalizadas em cada commit, inclusive atualização de dados não necessariamente alterados.
- A fila de middleware no `server.ts` e `runtimeRequestQueue.ts` serializa requisições de uma instância porque existem objetos mutáveis compartilhados em memória. Uma segunda instância não compartilha essa fila.
- As capturas mostram limites de egress e log ingestion excedidos no Supabase; a Vercel apresenta consumo relevante de Functions Storage e CPU. Os períodos e unidades não são diretamente comparáveis.
- Os logs indicam timeouts do PostgREST. A causa de toda ingestão histórica de logs não está estabelecida.
- A publicação em produção da refatoração **não foi executada**. PR de trabalho: #183.
- O banco tem migrações de novembro/2026 presentes no Supabase que não estão todas versionadas no repositório GitHub. Reconciliação exigida antes de migrações novas.

## 3. Modelo de dados e operações

**Meta:** PostgreSQL passa a ser a fonte de verdade transacional por TCC, participante, documento, autorização e evento. O estado global legado só permanece durante migração, sob controle explícito.

- GET `/processes`: consultar apenas registros autorizados e campos da lista, com paginação e ordenação estável; o servidor verifica identidade e autorização.
- GET `/processes/:id`: ler um TCC e suas dependências necessárias, não todo o sistema.
- Escrita: `{processId, expectedRevision, idempotencyKey, patch}`; validar formato e papel, comparar revisão por TCC e gravar em uma transação única.
- Requisições concorrentes em TCCs diferentes não devem competir por `revision` global; no mesmo TCC, conflito é explícito e recuperável (HTTP 409) sem sobrescrita automática.
- Alterações de acesso e revogações são verificadas no servidor antes de cada operação sensível, inclusive download. Não usar TTL como fonte de autorização.
- A confirmação de escrita exige commit confirmado; em timeout ambíguo, consultar por `idempotencyKey` e revisão antes de sugerir repetição.
- Histórico append-only desacoplado dos dados de edição, consultado em páginas ou chunks autenticados e íntegros.
- NUNCA fazer `SELECT *` em tabelas grandes para uma lista simples, montar cópias integrais em cada requisição ou reexecutar projeções de todos os TCCs em atualização unitária.
- A migração deve ser aditiva, validada com backfill, paridade, RLS, rollback e observabilidade; é vedada escrita dupla sem atomicidade.

## 4. Integração com Vercel

- API atua como camada curta de autorização, validação e orquestração, sem depender da memória compartilhada da função para consistência.
- Evitar funções enormes, dependências desnecessárias, imports pesados no caminho crítico, inicialização repetida e múltiplos endpoints de verificação para uma única ação.
- Requisições de leitura curta não precisam aguardar gravações de outros TCCs; filas por entidade só quando justificadas.
- Funções de geração documental, upload e download devem ter orçamento separado e destino explícito; não armazenar binários pesados em JSONB.
- `public` pode usar cache de conteúdo publicável e não sensível com invalidação; `private` tem cache segmentado por identidade e nunca deve reutilizar conteúdo de terceiros.
- Duplicidade de deployment e inclusão de artefatos devem ser verificadas por versão, sem apagar releases anteriores que suportem rollback.
- Ativar deploy apenas após confirmação de projeto, commit, variáveis de ambiente, testes, smoke e plano de retorno.

## 5. Identidade, sessão e Firebase

**Estado atual verificado no código:** `server/security/firebaseAuth.ts` implementa sessão própria com cookie `__Host-portal_tcc_session` em produção, HMAC-SHA256, `HttpOnly`, `SameSite=Lax`, `Secure`, expiração, OTP por e-mail e bootstrap Google. **Não equivale à utilização do Firebase Authentication**, apesar do nome do arquivo; o `package.json` não indica SDK Firebase na aplicação.

- Identidade autenticada não é autorização: os papéis institucionais e vínculos com TCC devem ser verificados a cada ação sensível.
- Não expor a chave `service_role`/secret Supabase, tokens OAuth de Google, segredos de sessão, códigos OTP nem credenciais de Asten ao browser, aos logs, a links ou ao GitHub.
- Manter proteção contra CSRF/origem, brute force, enumeração, seqüestro de sessão e revogação, com trilha de auditoria.
- Se houver migração futura para Firebase Auth, será **decisão separada** com verificação de tokens por backend, troca de sessão, políticas de revogação, migração segura de usuários e testes. Não migrar apenas por nome de arquivo.
- Cache de dados privados deve ser limpo quando trocar usuário, sessão, instituição ou permissão.

## 6. Google Drive: armazenamento e publicidade

**Padrão preferencial:** Drive guarda o arquivo original; Supabase armazena referências mínimas (`driveFileId`, tipo MIME, SHA-256, versão, tamanho, vínculo com TCC, estado de publicação e auditoria). Algumas rotas de transporte temporário usam Supabase Storage privado — isso não implica arquivo definitivo no Supabase.

**Privado:** objeto e pastas sem `anyone`, `domain` ou `group` indevidos; acesso pelo serviço autorizado no backend, depois de verificar sessão, vínculo ao TCC e permissão específica. O fato de a conta Master ser dona do Drive **não significa** que todos os demais possam baixar: o Portal pode mediar acessos autorizados. O código atual admite compartilhamento nominal de usuários nas pastas privadas; isso exige governança explícita, não é equivalente a exclusividade Master.

**Publicável:** primeiro registrar autorização de publicação e integridade do SHA; servir em rota pública do Portal que verifica estado, documento e versão; **manter o arquivo do Drive privado por padrão**. Não criar `anyone:reader` para todo documento publicado sem decisão administrativa; revogação pública deve ser efetiva na rota e, se aplicável, no Drive.

**Em toda operação:** minimizar leitura por byte-range/stream quando adequado, verificar SHA e metadados, evitar cópias redundantes, validar extensão/MIME e tamanho, não expor ID de arquivo como credencial de acesso nem redirecionar visitante para URL com privilégio. Links de Drive não são barreira de segurança.

## 7. Tratamento de falhas e UX

- Resposta do banco com 500, 503 ou timeout **não** vira array vazio ou status “sem dados”. Exibir “temporariamente indisponível”, manter o último estado já validado (quando mesma identidade e operação de leitura), com botão de atualização.
- Não dizer “salvo” antes de persistência confirmada. Evitar múltiplos cliques e repetição cega de POST.
- Persistir rascunhos com revisão e idempotência. Reconectar e retomar sem perder edições não confirmadas nem salvar duas vezes em silêncio.
- Sincronização em aba ativa, com backoff, jitter e revalidação após foco; evitar polling de payload global.
- Mensagens para usuários sem detalhes do banco/credenciais. Servidor registra códigos sintéticos e IDs de correlação sem PII sensível.

## 8. Observabilidade e orçamento

Painel de métricas: `request_count`, `bytes_in/out`, `db_calls_per_request`, `P50/P95/P99`, `cold_start`, `HTTP 409/429/503/5xx`, fila, retries, tempo de commit e falhas por rota. Custo normalizado por ação e usuário ativo; separar tráfego de bots, automações, portal público, ações reais e testes.

A ingestão de logs deve preservar segurança e investigação, mas reduzir ruído repetitivo onde a origem tiver sido identificada. Não desabilitar auditoria como paliativo. Monitorar egress, logs, CPU, Functions Storage e uso da infraestrutura antes/depois em janelas equivalentes.

## 9. Gatilhos de revisão / critérios de aceite

Rejeitar PR quando:
- altera esquema/produção sem rollback, backup validado ou migração versionada;
- introduz consulta de snapshot global no caminho comum;
- usa segredo privilegiado no cliente;
- elimina autorização de rota de download;
- confunde erro de rede com registro inexistente;
- não protege gravação concorrente e timeout ambíguo;
- transfere arquivo ou dado privado a rota pública indevida;
- não mede custo e latência ou não traz testes de regressão adequados.

Só promover para produção após CI verde, revisão de segurança, smoke com dados de homologação, testes de edição concorrente por TCC, revogação/login, downloads, Asten, Google Drive, confirmação de backup restaurável, verificação de variáveis e possibilidade de rollback.

## 10. Etapas e status

- **Feito na branch (sem deploy):** redução de leituras integrais quando revisão não mudou; cold start por capabilities; separação de bundles; polling adaptativo; erro explícito em lista TCC; modo opt-in de auditoria em chunks. Testes de CI e smoke devem passar na revisão final.
- **Pendente:** sincronização das migrações existentes em produção com o repositório; backfill/transação por TCC; substituição das três projeções integrais; remoção segura da fila global; testes de carga, segurança e restauração; homologação e medição real de economia.
- **Proibido antecipar:** ativar `PORTAL_AUDIT_DELTA_ENABLED=true`, publicar a branch na Vercel, alterar RLS ou migrar autenticação, sem gates de validação.

**Fontes:** código do repositório `FredericoZA/portal-tcc-enfermagem-ufes`; banco de produção Supabase do projeto; PR #183; capturas de uso Vercel e Supabase de 09/11/2026.
