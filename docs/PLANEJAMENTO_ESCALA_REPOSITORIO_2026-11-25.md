# Escala do repositório público do Portal TCC

## Capacidade a dimensionar

- Dimensione a operação administrativa para **100 TCCs por etapa**. Para o teste acumulado, considere 800 processos simultâneos, distribuídos nas oito etapas. Acompanhe separadamente cadastros, movimentações, assinaturas, uploads, tentativas de sincronização e retenção por período letivo.
- Para a consulta pública, simule **20×, 30×, 50× e 60×** o número atual de visitas. Meça a linha de base antes de converter esses fatores em demanda real. Inclua uma concentração de acessos após a divulgação de resultados.
- Os PDFs do acervo permanecem no **Google Drive**. A tabela contém os dados publicados e a URL estável de cada original autorizado. Busca, filtros, colunas, ordenação e paginação operam no navegador.

## Medição de 25/11/2026

A rota pública em produção respondeu com `no-store` e `MISS`. O catálogo mediu **349.345 bytes de JSON** e **89.989 bytes transferidos com compressão**. A abertura por botão consultava o Portal para resolver o endereço do Google Drive. Esses valores descrevem a implantação medida e servem de referência para o custo unitário.

A estimativa abaixo supõe uma transferência integral do catálogo por visita, um intervalo de 30 dias e o catálogo já medido, sem tráfego de HTML, imagens, JavaScript, outras telas ou operações internas. Use novos tamanhos medidos para o catálogo de 800 registros e suas partições.

| Hipótese de visitas atuais/dia | Multiplicador | Visitas/dia no cenário | Transferências em 30 dias | Catálogo em 30 dias |
| ---: | ---: | ---: | ---: | ---: |
| 100 | 20× | 2.000 | 60.000 | 5,4 GB |
| 100 | 60× | 6.000 | 180.000 | 16,2 GB |
| 500 | 30× | 15.000 | 450.000 | 40,5 GB |
| 500 | 50× | 25.000 | 750.000 | 67,5 GB |
| 500 | 60× | 30.000 | 900.000 | 81,0 GB |
| 1.000 | 60× | 60.000 | 1.800.000 | 162,0 GB |

O plano Hobby da Vercel lista 1 milhão de requisições CDN e 100 GB de Fast Data Transfer. A partir de 30 mil transferências diárias, esse catálogo sozinho consumiria cerca de 90% das requisições e 81% dos bytes incluídos. O cache na Vercel ajuda a origem, e as entregas do CDN continuam entrando na franquia. [Vercel Pricing](https://vercel.com/pricing) · [CDN pricing and usage](https://vercel.com/docs/manage-cdn-usage)

### Sensibilidade ao crescimento do catálogo

O volume de visitas e o tamanho da tabela crescem juntos. Para testar esse efeito até medir um acervo de 800 linhas variadas, use 300 kB de catálogo completo comprimido como hipótese de teste e 25 kB comprimidos como meta inicial para a primeira partição. As visitas podem abrir mais partições e consumir mais dados.

| Visitas/dia | Catálogo completo de 300 kB em 30 dias | Primeira partição de 25 kB em 30 dias |
| ---: | ---: | ---: |
| 6.000 | 54 GB | 4,5 GB |
| 30.000 | 270 GB | 22,5 GB |
| 60.000 | 540 GB | 45 GB |

A partição reduz bytes. A quantidade de entregas continua dependendo de onde a página é hospedada, quantos visitantes chegam e quantas partições eles consultam. Uma partição leve na própria Vercel ainda consumiria 1,8 milhão de requisições em 30 dias no cenário de 60 mil visitas diárias.

## Redução de tráfego preparada localmente

- A tabela usa uma rota compartilhada com revalidação em 120 segundos no CDN da Vercel. A resposta independe da sessão, pode ser reutilizada pelo navegador por 60 segundos e revalidada pelo ETag. Pedidos com parâmetros vão para a URL canônica e erros ficam fora do cache.
- Um acerto de cache evita executar a função e consultar o Supabase. Nos misses, a rota consulta a revisão e só volta a pedir a projeção quando necessário. A rota pública evita carregar o estado privado completo.
- O navegador mantém a última tabela por até 120 segundos para reaberturas na mesma sessão. A consulta pública da tabela fica fora do polling periódico. Durante a leitura da tabela, os demais recursos do Portal mantêm suas próprias regras de sessão.
- A coluna de documento abre o original no Google Drive quando a autorização e a identidade do arquivo estão confirmadas. Os documentos restritos usam as rotas autenticadas existentes. A permissão do Drive é a barreira efetiva para links que já tenham sido copiados.
- Teste local com 800 registros fictícios e 60 leituras concorrentes na mesma instância registrou uma leitura de revisão e uma de projeção. No navegador local, filtrar por presença de documento e abrir o link em uma nova aba não acrescentaram chamadas à API do Portal. A URL do Drive usada no teste era fictícia. Cache distribuído e quotas ainda precisam ser medidos em uma implantação de validação.

## Entrega definitiva para o cenário de 60×

1. **Gerar o catálogo quando o conteúdo público efetivamente mudar.** Produzir a lista e os links a partir de uma projeção pública com versão ou hash. Atualizar o manifesto apenas quando a publicação for confirmada. Durante a retirada, conferir a revogação no Drive e reconstruir o catálogo.
2. **Servir a página pública e o catálogo em hospedagem estática autorizada fora da Vercel.** Medir a cota dessa hospedagem para 60 mil visitas por dia. Manter uma página de entrada leve, com índice de cursos e períodos. Carregar a partição inicial e buscar períodos antigos sob demanda. Assim as consultas públicas e os cliques nos PDFs geram zero requisições para o Supabase e a Vercel. O botão de acesso ao Portal continua levando à aplicação que opera os processos.
3. **Economizar egress da operação.** Medir bytes e leituras por cadastro, revisão, assinatura e sincronização. Priorizar leituras restritas ao processo alterado e respostas condicionais. Comparar carga de 100 processos por etapa com a capacidade contratada. Medir os erros da fila de sincronização e a proporção de tentativas por arquivo. Usar links diretos para leitura quando autorizada e preservar o envio e a sincronização efetivos no Drive.
4. **Conter o tamanho do banco pela origem do crescimento.** A leitura de catálogo do Postgres mediu 57.961.619 bytes totais. Backups do estado, snapshot de transporte, auditoria e estado principal somaram cerca de 36,3 MB. Meça ocupação reutilizável e crescimento por operação. Verifique a política de arquivamento criptografado após 30 dias e a restauração antes de reduzir cópias persistentes. Transfira as leituras quentes para projeções ou linhas menores por processo antes de reavaliar a cópia de transporte. Preserve a trilha que prova consentimento, assinatura e retirada.
5. **Medir Log Query pela causa correta.** É volume varrido por quem consulta os logs. Use janelas curtas e filtros para investigar incidentes. Para monitoramento contínuo, prefira contadores agregados de tráfego, falhas e tamanho. Acompanhe ingestão de logs à parte. [Supabase Logs Query](https://supabase.com/docs/guides/platform/manage-your-usage/logs-query) · [Supabase Egress](https://supabase.com/docs/guides/platform/manage-your-usage/egress)

## Critérios antes de abrir para outros cursos

- Simular pico e tráfego sustentado a 20×, 30×, 50× e 60× com 800 registros variados. Usar várias sessões e comparar cache frio e quente. Projetar bytes com títulos, resumos e metadados variados.
- Confirmar zero chamadas à Vercel e ao Supabase na página estática pública, incluindo abrir um original no Drive. Conferir remoção de publicação, links ausentes e acesso privado em uma janela anônima.
- Medir o crescimento da base e o egress operacional em dois ciclos representativos de teste. Comparar a projeção do mês mais carregado com a franquia e reservar folga para reenvios, falhas e crescimento do catálogo.
- Antes de ampliar o uso institucional, validar as condições de hospedagem e as cotas do ambiente que servirá o tráfego esperado.
