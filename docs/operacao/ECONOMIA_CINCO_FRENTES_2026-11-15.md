# Economia de recursos — cinco frentes

## Gravações

Os projetores normalizados comparam cada entidade com o agregado canônico anterior, dentro da transação já existente. Uma correção de título não regrava outros TCCs. Alterações em pessoas, configurações ou assinaturas mantêm a projeção conservadora para preservar identidades compartilhadas, permissões e publicações. O CAS, a revisão e o commit atômico permanecem. O agregado JSON canônico ainda é gravado: esta mudança reduz as gravações derivadas e não representa migração completa para operações independentes por TCC.

Para reparar projeções manualmente, o backend pode executar uma transação com `SET LOCAL portal.force_full_projection='on'`. Não é uma configuração permanente. As migrações conferem o hash das funções instaladas antes de substituí-las; os rollbacks estão em `supabase/rollbacks`.

## Entrega pelo Drive

Além dos documentos administrativos, os botões Ver e Baixar PDF da entrega final usam links diretos para trabalho completo e resumo expandido quando a conta autenticada tem acesso nominal ao arquivo no Drive. Antes de redirecionar, o backend confere vínculo com o processo, tipo de arquivo, metadados, hash esperado e permissões. Não cria permissões públicas nem compartilha automaticamente com uma conta nova.

Sem acesso nominal confirmado, a entrega autenticada existente continua disponível. PDFs públicos, comprovantes gerados e alguns documentos históricos continuam passando pela verificação e entrega do portal. Esta rodada amplia a entrega direta; não torna todos os PDFs diretos nem publica originais privados.

## Leitura por tela

O repositório público usa uma RPC própria, anterior à fila do runtime mutável, com metadados necessários aos filtros existentes. Não transfere configurações, sessões, auditoria, modelos e respostas dos formulários. A aplicação mantém a sanitização pública e a regra de autorização do acervo histórico. Cada reaproveitamento em memória exige uma consulta atual da revisão. Falhas na leitura não retornam uma cópia local desatualizada. Os filtros e a paginação visual mantêm o contrato anterior; não se trata de paginação SQL do catálogo.

## Retenção de backups

A manutenção diária já existente processa até dois backups antigos por execução. Apenas backups do estado global com mais de 30 dias e pelo menos três cópias mais recentes no banco são candidatos. Cada cópia inclui estado integral e procedência original, é cifrada e enviada à pasta técnica privada do Drive. O arquivo é relido, decifrado e validado antes da finalização no banco.

A finalização confere novamente o hash e os critérios de retenção, grava um manifesto pequeno com ID e hashes da cópia no Drive, e só então remove a linha original, em uma transação. Falhas deixam o original no banco. Não há exclusão automática das cópias cifradas do Drive nesta política. O teste de restauração é isolado: nunca substitui o estado em produção. Não se executa VACUUM FULL ou outra operação bloqueante para forçar a redução física imediata do banco.

## Medição

`GET /api/admin/resource-usage` exige sessão e autorização administrativa e retorna contadores por categoria fixa: chamadas, bytes recebidos, erros e tempo até os cabeçalhos. A contagem acompanha o stream sem copiar o corpo. Não registra dados pessoais, URLs, consultas, tokens ou payloads, nem grava telemetria no banco. Os contadores abrangem somente a instância atual e reiniciam com ela; não são faturamento mensal nem agregação entre instâncias da Vercel.

Log Query mede consulta aos logs da plataforma, não o tamanho da auditoria do Portal. Não usar consultas amplas ao explorador de logs como monitoramento periódico. Comparar o consumo diário no painel após uso representativo. Nenhum teste local garante uma cota mensal ou otimização máxima.
