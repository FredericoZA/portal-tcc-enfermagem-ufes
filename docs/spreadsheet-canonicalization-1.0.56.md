# Portal TCC 1.0.56 — contrato canônico de planilhas

Esta rodada elimina correções concorrentes entre planilhas e define um contrato único para os elementos compartilhados.

## Elementos obrigatoriamente comuns

- uma única barra de rolagem por planilha;
- cabeçalho sticky em todas as planilhas;
- coluna `Processo` sticky em todas as linhas;
- coluna de seleção sticky quando existir;
- checkbox com área clicável consistente;
- uma única paginação por planilha, fina e alinhada à direita;
- rótulo canônico `Processo`;
- quantidade por página 25 / 50 / 100 / Todos.

## Responsabilidade do runtime

`PortalSpreadsheetRuntime` pode cuidar somente de comportamento estrutural comum: marcação sticky, rolagem, paginação e normalização do rótulo Processo.

Ele não pode:

- criar uma segunda tabela para representar outro filtro;
- manter estado paralelo de filtros de negócio;
- substituir estado React da tela por manipulação concorrente do DOM;
- criar paginações específicas por tela.

## Responsabilidade das páginas

Filtros de negócio e seleção de dados pertencem ao estado React de cada página. A aparência desses controles pode usar componentes compartilhados, mas a regra de negócio deve ter uma única fonte de verdade.

## Critérios desta rodada

1. Lista de Defesas, Repositório, Meus TCCs e Presidente devem obedecer ao mesmo chrome de planilha.
2. Nenhuma planilha pode exibir mais de um pager.
3. Nenhuma linha pode perder o sticky da coluna Processo.
4. O Presidente não pode ter uma tabela alternativa criada pelo runtime.
5. Meus TCCs não pode ter dois conjuntos independentes de estado de filtro.
