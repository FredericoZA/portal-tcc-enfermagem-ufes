# Entrega técnica para revisão — Portal TCC (09/11/2026)

**PR:** [#183](https://github.com/FredericoZA/portal-tcc-enfermagem-ufes/pull/183)  
**Branch:** `perf/supabase-runtime-revision-gate-20261109`  
**Status operacional:** ainda **não publicado na Vercel**, sem merge na `main`, sem alteração destrutiva no banco e sem movimentação dos arquivos existentes do Drive.

## 1. Escopo desta entrega

Otimização incremental do runtime Supabase/Vercel, redução da leitura redundante do JSONB global, diminuição de consultas de sincronização, tratamento correto de indisponibilidade da lista de TCCs, simplificação da inicialização das funções, organização do Drive e remoção do cabeçalho redundante em Configurações.

Não se deve afirmar que a persistência **granular por TCC** está pronta: o backend ainda depende do `portal_runtime_state` e de `portal_commit_runtime_state`, com projeções globais. Este continua sendo o principal trabalho da próxima etapa.

## 2. Configurações do Portal — título

- `src/App.tsx`: removido texto redundante do título encaminhado à aba Configurações.
- `src/pages/ConfiguracoesPage.tsx`: o hub de opções operacionais permanece; não há novo quadro de título genérico.
- `server/documentCatalogReservationPolicy.test.ts`: teste de regressão para impedir retorno de "Configurações do Portal" e do título redundante anterior.

**Atenção:** efeito visual no endereço de produção só é verificável após uma publicação aprovada e smoke real.

## 3. Catálogo de documentos do Google Drive

Estrutura institucional **aditiva** gerenciada por `DRIVE_FOLDER_NAMES`:

```text
PORTAL_TCC/
  01_DOCUMENTOS/
    01_CARTA_CONVITE/
    02_ATA_DEFESA/
    03_TERMO_AUTORIZACAO/
    04_DECLARACAO_PARTICIPACAO/
    05_INSTRUMENTO_AVALIACAO_LEGADO/
    06_COMPROVANTE_RESERVA/
      00_MODELO_ATIVO/
      01_HISTORICO_MODELOS/
      02_GERADOS/
  02_PROCESSOS/
```

As categorias assináveis mantêm `03_ASSINADOS` quando aplicável. Convites e comprovantes não geram pastas assinadas. `DECLARACAO_COMPARECIMENTO` não é parte do arquivo automático, pois é um modelo para preenchimento e assinatura manual.

**Alterações:**
- `server/integrations/googleWorkspace.ts` e `src/services/googleDriveOrganizer.ts`: inclusão do comprovante (06) e do instrumento de avaliação legado (05), mantendo os demais diretórios e modelo/histórico/gerados/assinados conforme natureza.
- `server/integrations/googleDriveArchive.ts`: `uploadProcessFormPdf` envia `CONFIRMACAO_LOCAL` para `01_DOCUMENTOS/06_COMPROVANTE_RESERVA/02_GERADOS` quando há raiz configurada. `uploadProcessSourcePdf` envia também PDF de comprovação `COMPROVANTE_LOCAL` para esse mesmo catálogo. Ambas preservam SHA-256, versão, tipo e vínculo do processo; operações são idempotentes e rejeitam hashes divergentes.
- `server.ts`: chamadas de upload passaram a fornecer `rootFolderId`; reservas confirmadas exigem que o comprovante seja arquivado antes de prosseguir com emissão e comunicações. Em falha, a resposta já salva não é desfeita: o fluxo informa pendência recuperável e preserva o comprovante na fila.
- `server.ts`: `archiveProcessFormSnapshot` não regenera PDF nem reenvia arquivo para a mesma revisão já arquivada.
- `server/documentCatalogReservationPolicy.test.ts`: testes de catálogo, caminho de upload e ausência de título redundante.

**Não houve migração dos arquivos legados existentes do Drive.** Seus IDs e caminhos antigos são mantidos. A migração histórica exige inventário, deduplicação por `processId`/`formType`/`version`/`sha256`, conferência de permissão, cópia verificada e registro auditável, sem apagar os originais.

## 4. Supabase — otimizações existentes no PR #183

- `server/integrations/supabase.ts`: checagem de `revision` em cada requisição, com recuperação do snapshot completo somente após mudança ou cold start; falha fechada se revisão não puder ser confirmada.
- `server.ts`: remoção da dupla hidratação nos indicadores públicos; invalidação segura de revisão após falha de commit.
- `server/integrations/supabase.ts`: cold start valida capabilities por uma RPC; diagnóstico administrativo aprofundado continua disponível.
- `server/integrations/supabaseAuditSnapshot.ts`: composição segura dos blocos de auditoria por fingerprints, isolados por namespace; modo de carregamento `PORTAL_AUDIT_DELTA_ENABLED=true` preparado **mas não habilitado** na Vercel. Histórico ausente causa erro, não retorno silenciosamente vazio.
- `src/components/PortalLiveSync.tsx` e `src/utils/portalLiveEvents.ts`: intervalos adaptativos de 30–60 s em vez de 15 s fixos e pausa offline/aba oculta.
- `src/pages/MeusProcessosPage.tsx`: falha de leitura não é mostrada como "nenhum TCC".

**O que não foi resolvido:** o commit legado ainda reprocessa projeções de todo o estado. Não criar mais cópias de tabelas/índices sem avaliar o custo real. A segunda fase exige transações pequenas por TCC, revisão por entidade, gravações idempotentes e remoção progressiva da fila serial global.

## 5. Vercel — otimizações existentes no PR #183

- `vercel.json`: separação dos artefatos específicos das funções, para não empacotar explicitamente o servidor monolítico em cada função especializada.
- `scripts/test-serverless-build.mjs`: smoke de imports em Node sem TypeScript e com funções isoladas.
- `api/index.ts` e `server/vercel/index.ts`: runtime preservado, sem alterações de credenciais.
- Build, CI e CodeQL rodam no GitHub; os testes de produção devem ser reexecutados para o SHA final do PR.
- `vercel.json` continua com `git.deploymentEnabled=false`: nenhuma publicação automática pelo GitHub.

## 6. Segurança e controle de acesso

- Sessões do Portal continuam HMAC-SHA256 com cookie seguro e verificação da API. O arquivo `firebaseAuth.ts` não significa Firebase Authentication ativo.
- `SUPABASE_SECRET_KEY` e tokens OAuth do Google não são públicos.
- Documentos privados no Drive permanecem privados. O Portal autoriza downloads por identidade e vínculo do TCC; publicação pública é uma rota específica que verifica status, versão e hash sem liberar a pasta inteira como `anyone:reader`.
- Não alterar políticas RLS nem mover arquivos automaticamente. Arquivos públicos e privados podem ter requisitos de retenção e sigilo; Drive não substitui autorização da API.

## 7. Estado de verificação e implantação

Antes de publicar:
1. Confirmar CI, CodeQL e QA visual no **último SHA**, incluindo teste de novos caminhos e fluxo de reserva.
2. Testar cadastros, confirmação manual e departamental, declaração de participação, convite, ata, termo, instrumentos legados, assinatura, downloads, autorização/revogação e rascunhos.
3. Conferir backup restaurável do Supabase e reconciliação das migrações efetivamente aplicadas (o banco apresenta migrações recentes ausentes do histórico GitHub).
4. Em ambiente de homologação, executar bootstrap seguro do Drive e confirmar que `06_COMPROVANTE_RESERVA` contém um PDF por versão, sem criar `03_ASSINADOS`.
5. Validar regressões de timeout e latência P50/P95, egress, ingestão de logs, tamanho de funções e consumo real antes/depois.

**Atenção:** as modificações de rotas e pastas são código pronto para publicação após revisão, não ações realizadas no Google Drive real.

## 8. Handoff — próxima refatoração de banco

Substituir progressivamente o agregado global por `portal_processes` e relações como fonte de verdade, com RPC por TCC e `expectedDataRevision`, `idempotencyKey`, commit único, restrição por identidade, rollback e reconciliação. Manter integridade de documentos e histórico; não fazer `DROP`/limpeza em produção antes de backup e restore testado.

**Responsável pela publicação:** revisão humana no ambiente de casa; deploy de produção reservado para depois da homologação.
