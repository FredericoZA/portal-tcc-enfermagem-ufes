# Indicadores públicos do Portal TCC

As métricas usam o mesmo estado de processos submetidos e registros legados. Rascunhos ficam fora. A origem ativa e o acervo legado usam identificadores próprios. O painel não tenta deduplicar trabalhos pelo título. Exclusões saem da base ativa pelo fluxo administrativo. Uma recusa de local, por si só, não cancela o cadastro.

| Indicador | Regra de cálculo |
|---|---|
| Cadastrados | Total de processos efetivamente submetidos e legados carregados. |
| Defesas realizadas | Data válida já ocorrida em São Paulo, com situação concluída ou registro de conceito e ata concluído. A data de uma reserva passada, sozinha, não é evidência de defesa. |
| Concluídos | Situação registrada `CONCLUIDO`. Um registro concluído com data de defesa ausente ou inválida integra esta contagem e fica fora da série de defesas. |
| Em andamento | Cadastrados menos concluídos. |
| Taxas de defesa, conclusão e coautoria | Numerador correspondente dividido pelo total cadastrado. Coautoria exige segundo autor registrado. |
| Situação dos processos | Contagem por situação registrada. O denominador do percentual é o total cadastrado, inclusive quando uma situação não aparece no gráfico por proteção de grupos pequenos. |
| Evolução anual e mensal | Contagem de defesas realizadas pela data civil em São Paulo. Registros legados usam dia e hora informados na origem, inclusive nos anos de horário de verão. Meses sem divulgação ficam fora da série e das comparações entre meses consecutivos. |
| Período acadêmico informado | Contagem dos TCCs cadastrados pelo rótulo declarado pelo aluno, como 2026-1 ou 2026-2. É uma dimensão própria, independente do ano e mês real da defesa. Respostas ausentes ou inválidas entram em Não informado. Cada grupo segue o mesmo limite de divulgação das outras categorias. |
| Dia da semana e turno | Distribuição das defesas realizadas com a informação correspondente. Manhã até 11h59, tarde de 12h a 17h59 e noite a partir de 18h. Sem hora registrada, a defesa entra no dia da semana e fica fora dos turnos. |
| Média, mediana, desvio-padrão e mês de pico | Base de meses divulgados. O desvio-padrão usa a população observada. A participação do pico usa como denominador todas as defesas realizadas. |
| Tempo médio e mediano | Dias entre cadastro e conclusão de processos atuais, a partir de dois horários válidos e cronologicamente consistentes. Os legados não entram porque não têm esses dois horários. |
| Tipo de trabalho e resultado | Categorias estruturadas, respectivamente entre concluídos e entre registros com resultado conhecido. As proporções das listas usam as categorias divulgadas. |
| Publicação | Métrica de API sobre registros concluídos com publicação pública vigente e arquivo disponível. A autorização de publicação permanece independente do estado de conclusão. |

O painel oculta o detalhamento com menos de cinco TCCs na base e cada categoria com menos de três ocorrências. As séries públicas podem somar menos que o total de defesas. Os meses omitidos incluem meses sem defesas registradas e meses com amostra pequena. Não se atribui zero a esses meses para calcular médias ou variações.

Em 07/11/2026, o responsável definiu que o período será informado pelo aluno para fins estatísticos. A pergunta opcional fica na seção Trabalho do novo cadastro. As opções incluem o ano anterior, o atual e o seguinte no fuso de São Paulo, com os semestres 1 e 2 e a opção Não informado. Uma resposta válida já salva continua disponível ao reabrir o rascunho. O período fica em uma única chave de metadado nas respostas do cadastro, `PERIODO_ACADEMICO_ESTATISTICO`. Ele não cria janela de reserva, não altera data ou etapa e não é preenchido automaticamente para registros existentes.

A consulta de 06/11/2026 registrou na página do curso a janela de 13 a 17 de julho de 2026 para 2026/1. Na reconferência de 07/11/2026, a página apresentava apenas o link de acesso ao Portal. Essa referência histórica não determina o período estatístico declarado. As datas individuais dos legados 103–108 continuam sujeitas à conferência das atas ou da agenda oficial. [Página oficial de envio do TCC](https://enfermagem.vitoria.ufes.br/pt-br/envio-do-trabalho-de-conclusao-de-curso)

## Reconciliação entre painel e relatório administrativo

O painel público e a API administrativa de indicadores usam o mesmo construtor e o mesmo estado de atuais + legados. O relatório institucional avançado recebe os processos atuais da sua rota; comparar seus números com o acervo inteiro exige primeiro igualar esse recorte. Ele não passa a incluir documentos ou datas históricas por inferência.

Para um mesmo conjunto de entrada, painel e relatório compartilham as regras de cadastro submetido, defesa registrada e duração de conclusão. Rascunhos não contam como TCCs cadastrados. A duração exige `createdAt` e `completedAt` válidos, ordenados e não futuros; `updatedAt` não substitui o término do processo e registros importados não recebem duração presumida.

No relatório avançado, o período declarado pelo aluno tem prioridade. Um ciclo acadêmico explicitamente cadastrado continua disponível para compatibilidade. Sem uma dessas informações o período fica desconhecido (`SEM_PERIODO`); mês da defesa ou do cadastro nunca é convertido automaticamente em semestre acadêmico.
