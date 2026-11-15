# Publicação e consumo — 15/11/2026

Publicação autorizada pelo responsável após revisão das telas. Este registro distingue a medição real do banco das medições locais e da captura de uso da organização.

## Supabase verificado

Projeto `vvgdmycmotazqjvpywmk` (Portal TCC), ativo. Antes da publicação do aplicativo:

| Medida | Resultado |
| --- | ---: |
| Banco da aplicação `postgres`, `pg_database_size` | 45.968.531 bytes |
| Total do cluster, incluindo os dois bancos de modelo do Postgres | 61.092.017 bytes |
| Tabela de backups de manutenção, incluindo índices/TOAST | 15.622.144 bytes |
| Quantidade de backups explícitos | 11 |
| Backup mais recente | 11/11/2026 |
| Auditoria normalizada, incluindo índices/TOAST | 5.988.352 bytes |
| Recursos visuais de runtime, incluindo índices/TOAST | 3.219.456 bytes |
| Estado operacional canônico, incluindo índices/TOAST | 1.417.216 bytes |
| JSON canônico, sem compressão | 1.875.041 bytes |

A captura enviada pelo usuário está em “All projects”: 0,061/0,5 GB de Database Size, 0,32/5 GB de egress e 17,327/100 GB de Log Query. A conferência adicional do cluster encontrou `postgres` com 45.976.723 bytes, `template0` com 7.520.783 e `template1` com 7.594.511. A soma, 61.092.017 bytes, corresponde ao valor arredondado de 0,061 GB da captura. Cerca de 15,1 MB são dos bancos de modelo do próprio Postgres, que não devem ser apagados. A captura anterior mostrava 0,060 GB de banco; a diferença exibida é cerca de 1 MB, sem crescimento comprovadamente linear.

Não foram apagados backups, documentos, processos ou auditoria histórica. Os backups são explícitos de manutenção; a última inclusão foi em 11/11, não um backup novo a cada consulta. Não foi executado VACUUM FULL nem removidos índices apenas por estarem sem uso nas estatísticas.

## Melhorias instaladas no banco

- `conditional_runtime_projection`: leitura LITE/LEAN com confirmação do hash atual; quando o conteúdo necessário não mudou, o banco devolve a revisão e o hash sem repetir o conteúdo.
- `paged_critical_audit`: primeira página e continuação da auditoria crítica no banco, no máximo 101 ocorrências por leitura. Buscas, filtros e exportações conservam o contrato completo.
- As duas funções são somente leitura, `SECURITY INVOKER`, com execução exclusiva de `service_role`; confirmado que `anon` e `authenticated` não têm execução.
- `PORTAL_RUNTIME_LITE_READS=true` confirmado nas configurações de produção da Vercel. A leitura condicional é habilitada por padrão no código desta versão.

Medição no banco real, revisão 1496: primeira resposta LEAN com 673.833 bytes; repetição com o mesmo hash, 118 bytes e payload omitido (99,98% menos neste cenário). Página de auditoria: 118.210 bytes e 101 ocorrências, de 224 ocorrências críticas. São tamanhos JSON produzidos no banco, sem cabeçalhos HTTP/compressão; não são uma promessa de redução percentual mensal.

As migrações não alteraram a revisão, os cinco processos operacionais nem os 332 eventos existentes. A redução dos novos registros rotineiros é aplicada pelo aplicativo quando publicado. Falhas, responsabilidade por correções e controles de recuperação permanecem.

## Log Query

É o volume examinado ao consultar os logs da plataforma pelo painel, CLI ou API; não o volume das consultas SQL comuns nem o tamanho do Registro de Logs do Portal. Não há chamada à API de consulta dos logs da plataforma no runtime revisado do Portal. Portanto, apagar auditoria do Portal não zera esse indicador.

A documentação do Supabase orienta usar janelas pequenas, filtros na consulta e evitar polling do Logs Explorer. Nesta investigação foram usados metadados SQL e advisories, sem varrer o endpoint de logs. O valor já consumido no ciclo não diminui retroativamente.

Fonte: https://supabase.com/docs/guides/platform/manage-your-usage/logs-query

## Limites que permanecem

- O commit ainda sincroniza projeções normalizadas e algumas operações carregam o estado global. Uma evolução por entidade exige migração própria e teste de equivalência para preservar permissões, concorrência e dados.
- A paginação reduz transferência; ainda examina o JSON canônico dentro do Postgres.
- Ver/Baixar direto do Drive está disponível para documentos administrativos quando a permissão nominal é confirmada. Os demais caminhos conservam a entrega protegida; nem todo download evita a Vercel.
- Os recursos estáticos já vêm do próprio site, sem uma leitura do Drive por acesso.
- A economia mensal deve ser acompanhada pela diferença diária após este release, por projeto, sem extrapolar um percentual acumulado como taxa diária.

## Validação e publicação

Resultados locais em `output/release-20261115/`; resultado do deploy e conferência de produção serão registrados após a conclusão. Não considerar um build local como comprovação da versão publicada ou de uma assinatura real no ASTEN.
