# Inteligência contínua e estatísticas

## Resultado

O portal mantém dois arquivos Markdown privados e atualizáveis:

1. `MEMORIA_CONTINUA_FLUXOS_E_MELHORIAS.md`
2. `PANORAMA_ESTATISTICO_DOS_TCCS.md`

Eles ficam em `00_SISTEMA/01_INTELIGENCIA_CONTINUA` dentro da pasta raiz privada do portal. Cada atualização substitui o conteúdo do mesmo arquivo, mantendo o ID estável e criando uma revisão no Google Drive. Assim existem exatamente dois arquivos ativos, sem cópias diárias espalhadas.

## Atualização

- **Diária:** a rota autenticada `/api/cron/storage-cleanup` executa a manutenção do staging e recalcula os relatórios.
- **Sob demanda:** o Master usa **Configurações → Operação, continuidade e conformidade → Atualizar os dois arquivos**.
- **Sem Google conectado:** os relatórios continuam disponíveis para download no painel, com a sincronização do Drive marcada como pendente ou falha.
- **Persistência:** estatísticas, propostas, decisões e metadados dos arquivos integram o estado transacional e o backup do portal.

## Memória contínua de fluxos e melhorias

As regras observam evidências registradas pelo próprio sistema:

- falhas definitivas de fluxo, Gmail, Asten ou arquivamento no Drive;
- processos abertos sem movimentação além do prazo definido pelo Master (padrão: 30 dias);
- solicitações de correção abertas ou em análise;
- baixa cobertura de área, tema, tipo de estudo ou finalidade.

Cada proposta preserva prioridade, evidência, ação recomendada e decisão do Master. Os estados são `PROPOSED`, `APPROVED`, `REJECTED` e `IMPLEMENTED`.

Uma aprovação **não muda o sistema**. Ela apenas registra a decisão. O Master ainda precisa editar o Estúdio, validar o pacote e publicar a nova revisão. Essa separação impede que uma regra estatística altere um procedimento acadêmico ou documental sem supervisão.

## Panorama estatístico

O arquivo consolida:

- TCCs, autores, coautoria, defesas avaliadas, conclusão e publicação solicitada;
- mediana do tempo até a conclusão e idade dos processos abertos;
- distribuição por situação, resultado, tipo de trabalho e formato de defesa;
- áreas, temas, tipos de estudo, finalidades e palavras-chave;
- cobertura de preenchimento dos campos analíticos;
- evolução por período acadêmico;
- mediana de espera por etapa, assinatura e arquivamento, com tempos desconhecidos explicitados.

Percentuais usam todos os TCCs como denominador, salvo quando a própria tabela informa outra base. A mediana de conclusão considera somente processos concluídos.

## Campos canônicos

O modelo inicial oferece estes campos configuráveis:

| Informação | Chave recomendada | Aliases reconhecidos |
|---|---|---|
| Área temática | `AREA_TEMATICA` | `AREA_DE_CONCENTRACAO`, `LINHA_DE_PESQUISA`, `AREA` |
| Tema principal | `TEMA_PRINCIPAL` | `TEMA`, `EIXO_TEMATICO` |
| Tipo de estudo | `TIPO_DE_ESTUDO` | `DESENHO_DO_ESTUDO`, `METODOLOGIA` |
| Finalidade | `FINALIDADE_DO_TRABALHO` | `FINALIDADE`, `DESTINACAO` |

Na Oficina, o Master mantém um catálogo de valores, sinônimos, vigência e ativação para cada um desses campos. O cadastro usa as opções válidas; classificações fora do catálogo permanecem desconhecidas. Padronizar as opções melhora a estatística. O sistema não classifica trabalhos pelo título ou resumo e não inventa valores ausentes.

## Privacidade e qualidade

- Os arquivos não contêm nomes, e-mails, matrículas, títulos nem resumos.
- Categorias temáticas com menos de três ocorrências são agrupadas como grupos protegidos.
- Valores ausentes aparecem como cobertura incompleta; não são preenchidos por inferência.
- Os arquivos ficam na pasta privada do Drive e só aparecem no painel administrativo.
- Os limiares de 30 dias e 70% e a prioridade diagnóstica são editáveis na Oficina. São regras iniciais, não metas acadêmicas. Devem ser revistos pelo Master depois de uma linha de base confiável.

## Homologação obrigatória

Com as credenciais reais, confirme atualização manual, execução diária, pasta privada, IDs estáveis, novas revisões, ausência de dados pessoais e preservação das decisões do Master. Sem esse piloto, a integração com o Drive permanece **não confirmada**.

## Painel RC8

O panorama permite filtrar e comparar períodos, consultar nove distribuições, visualizar as esperas e exportar CSV ou um relatório institucional em PDF. O novo PDF inclui síntese executiva, gráficos vetoriais, tabelas, finalidade, metodologia, privacidade e limitações. As medianas e indicadores comparativos exigem três observações. No CSV, valores com possível fórmula são neutralizados.

O arquivo de memória inclui os eventos e a quantidade de ações da revisão publicada. A atualização preserva as decisões anteriores; uma falha de fluxo recuperada deixa de aparecer como evidência ativa.
