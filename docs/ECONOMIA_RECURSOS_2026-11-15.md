# Economia de recursos rodada local de 15 novembro 2026

## Implementado

1. Histórico crítico paginado no banco para a navegação padrão do registro de logs, global ou por TCC. A RPC retorna no máximo 101 ocorrências (100 da página e uma para detectar continuação), sem carregar todos os snapshots de auditoria pela rede. O total permanece correto. Empates de horário usam ordenação determinística de identificador compartilhada entre SQL e servidor.
2. Página vinculada à mesma revisão usada na leitura de permissões. Se a revisão mudar, a leitura falha de modo seguro. SQL e helper são somente leitura, exclusivos de service_role; anon e authenticated não podem executá-los. Nenhuma cópia adicional de histórico ou tabela foi criada.
3. Compatibilidade de publicação: se a migração não estiver instalada, o servidor conserva a leitura completa existente e reconfirma sessão e Master antes de responder. A economia de hidratação depende também da configuração PORTAL_RUNTIME_LITE_READS=true, que deve ser conferida no release.
4. Downloads públicos com ETag do SHA256 aprovado, cache privado e revalidação obrigatória. A permissão de publicação é conferida antes do 304. Primeiro download continua vindo do Drive, com a conferência de hash existente. Uma versão já recebida e ainda autorizada pode ser reaproveitada pelo navegador sem novo PDF pelo Drive/Vercel. Não foram publicados links permanentes do Drive nem alteradas permissões de arquivos.

## Medição reproduzível

Fixture de 1.500 registros, com conteúdo extenso e envios de e-mail. Medição de respostas do banco, sem compressão e sem contabilizar a leitura operacional LEAN separada:

- Conteúdo canônico: 9,439,170 bytes.
- Página do histórico: 618,005 bytes.
- Retorno: 101 ocorrências, antes de mostrar as 100 da página.
- Redução de bytes nesse cenário: 93.45%.

A redução não representa o consumo total da requisição, o processamento dentro do Postgres ou uma previsão mensal. O banco ainda examina o JSON canônico para selecionar a página; a transferência é que fica limitada. A leitura operacional e suas validações permanecem.

No teste HTTP, o download inicial devolveu os bytes e o ETag; após retirar o arquivo apenas da fixture, a requisição com o mesmo ETag devolveu 304 sem corpo. Um ETag diferente não pulou a leitura do arquivo. Após retirar a publicação na fixture e reiniciar, o mesmo ETag devolveu 404, não 304.

## Verificação

- 4 testes de helpers/RPC/SQL passaram.
- 8 testes HTTP e de autorização/projeção passaram.
- 26 testes de regressão passaram.
- Comparação adicional passou para todas as ações excluídas da auditoria crítica, para evitar divergência futura entre SQL e TypeScript (2 testes).
- TypeScript, build, smoke HTTP e artefatos serverless passaram. Build conserva os avisos conhecidos de tamanho de chunks.
- Testes SQL usaram Postgres local em PGlite; providers externos não foram chamados.

## Limites e trabalho ainda aberto

- Buscas textuais, filtros por tipo/data, exportações e foco em uma ocorrência conservam o caminho completo. A navegação padrão é a parte otimizada nesta rodada.
- Algumas gravações continuam utilizando o estado global e o controle atual de concorrência. Não foi feita migração geral para escrita por TCC.
- O primeiro download continua transferindo o PDF pela Vercel. O reaproveitamento depende do suporte e do cache do navegador; não elimina todo o tráfego de arquivos.
- Aplicação das migrações, publicação Vercel e medição no Supabase real continuam aguardando a liberação do usuário. Nenhuma alteração em produção nesta rodada.

## Arquivos principais

- server/auditPageRead.ts e server/auditFeed.ts.
- server/integrations/supabase.ts.
- supabase/migrations/20261115140000_paged_critical_audit.sql.
- server/publicDownloadRevalidation.ts e integração em server.ts.
- Evidências: economy-page-tests.log, economy-policy-parity-final.log, economy-http-tests.log, economy-regressions-final.log.

## Acesso direto ao Drive — documentos administrativos

Pedido adicional: Ver e Baixar devem utilizar o Drive para evitar transportar o PDF pela Vercel.

Implementação local de 15/11:

- Os cartões de documentos administrativos tentam resolver os links oficiais `webViewLink` e `webContentLink` no backend autenticado, após os mesmos controles de vínculo, visibilidade e disponibilidade do download existente.
- A resolução só retorna links quando o Drive confirma uma permissão nominal para o e-mail autenticado. Não cria permissões, cópias ou compartilhamento público.
- Consulta permissões e metadados, sem `alt=media`. Confere processo, tipo, solicitação de assinatura e hash de metadados quando disponível. Essa conferência não equivale a recalcular o hash dos bytes a cada abertura.
- Sem permissão nominal, link válido ou confirmação do provedor, conserva a visualização/download protegido pelo Portal. Pop-ups bloqueados também utilizam essa alternativa.
- Arquivos locais demonstrativos utilizam a alternativa existente; não simulam homologação com Google.
- Links ficam restritos a HTTPS em hosts oficiais do Drive e não incluem credenciais de API. A resposta JSON não pode ser armazenada em cache.

Limites: esta alteração cobre os cartões de documentos administrativos gerados/arquivados. Comprovantes, arquivos acadêmicos, legados e consultas públicas ainda usam os caminhos anteriores. A publicação atual serve arquivos privados do Drive pelo Portal; não foi substituída por permissões `anyone`. Para retirar esse tráfego também será necessário preparar um fluxo de publicação/revogação de cópias autorizadas e homologar as contas Google dos participantes. Nenhuma permissão real nem implantação foi alterada.

Validação: testes do resolvedor com provedor simulado, teste HTTP isolado de autenticação/vínculo/arquivo indisponível/alternativa PDF local, TypeScript e build. O teste unitário confirma apenas GETs de permissões/metadados, sem download do PDF ou escrita no Drive. Não há medição de consumo real desta rodada.
