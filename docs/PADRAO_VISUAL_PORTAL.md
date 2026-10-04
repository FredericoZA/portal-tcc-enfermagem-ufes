# Padrão Visual Oficial — Portal TCC

Este documento registra os invariantes visuais do Portal. Eles devem ser reutilizados em todas as abas, tabelas, planilhas, pop-ups e áreas administrativas. Mudanças locais não devem criar uma nova paleta ou um novo padrão de espaçamento.

## 1. Hierarquia de superfícies

1. **Fundo geral da página:** branco-gelo `#f1f5f9`.
2. **Superfície principal de tela/planilha:** `#e1e6e9`.
3. **Blocos/células internas:** `#d5dce0`.
4. **Conteúdo de contraste, inputs e cartões internos:** branco `#ffffff`.

A hierarquia deve ser visível. Nunca usar a mesma cor para fundo geral, planilha e blocos internos.

## 2. Planilhas e tabelas

- Texto padrão: **preto**.
- Sem margem superior ou inferior própria na tabela.
- Textos internos de célula não devem adicionar margens verticais.
- Botões ordinários da planilha: **brancos**, borda neutra e texto escuro.
- Cabeçalho, barra de ferramentas e filtros: compactos.
- Primeiras colunas não podem ganhar fundo branco isolado por regra sticky/local.
- A superfície-base da planilha deve ser a mesma em Lista de Defesas, Repositório, Meus TCCs e Área do Presidente.
- Cores diferentes só devem aparecer quando tiverem função semântica real, como status, situação ou papel.

## 3. Barras e separadores

- Sidebar: escura.
- Rodapé: escuro.
- Barra superior: mesma família da superfície principal da planilha.
- Barra de título da planilha: **45 px**.
- Quando houver filtros: separador de **5 px**, barra de filtros de **45 px** e separador de **15 px** antes do cabeçalho.
- Quando não houver filtros: usar apenas o separador de **15 px** entre título e cabeçalho.
- Cabeçalho útil das colunas: **35 px**.
- Não empilhar bordas adicionais sobre esses separadores.

## 4. Botões

- Botão comum: fundo branco.
- Texto: escuro/preto.
- Borda: cinza neutro.
- Verde não deve ser usado indiscriminadamente em botões comuns.
- Verde é prioritariamente identidade institucional, barras, destaques e ações realmente principais.
- Estados acadêmicos podem usar suas cores semânticas próprias.

## 5. Pop-ups e modais

- Fundo principal do pop-up: `#e1e6e9`.
- Campos e cartões internos podem usar branco.
- Cabeçalho deve seguir a identidade institucional.
- Evitar padding vertical excessivo.
- Título deve permanecer centralizado quando o botão fechar estiver presente.
- Botões comuns dentro do pop-up continuam brancos; ação principal pode usar o verde institucional.

## 6. Densidade e espaçamento

- O Portal deve ser compacto.
- Evitar margens superiores e inferiores sem função.
- Barra de título: **45 px**.
- Barra de filtros: **45 px**.
- Cabeçalho das colunas: **35 px**.
- Linha de dados: mínimo de **30 px**.
- Paginação integrada: **24 px**.
- Controle circular do cabeçalho: **15 × 15 px**.
- Evitar cartões com padding vertical excessivo.
- Inputs e botões fora das planilhas mantêm suas dimensões anteriores.
- Espaçamento deve separar grupos funcionais, não criar áreas vazias.

## 7. Regra de implementação

O arquivo `src/portal-surface-contract.css` é a camada visual autoritativa e deve ser carregado por último. Regras locais não devem contradizer este contrato. Quando surgir uma inconsistência visual recorrente, a correção deve preferencialmente ser feita no contrato global em vez de criar um novo remendo específico por tela.

## 8. Exceções

Cores e estilos fora deste padrão só são permitidos quando representam informação semântica necessária, por exemplo:
- situação da defesa;
- status de assinatura;
- papel do usuário;
- alertas, erros e sucesso;
- elementos de identidade institucional.

Essas exceções não alteram a hierarquia-base de superfícies.


## 9. Contrato único das cinco superfícies tabulares

O contrato canônico é aplicado a **Calendário, Lista de Defesas, Meus TCCs, Área do Presidente e Repositório**. O conteúdo e as colunas podem variar, mas a anatomia visual não. A implementação usa os atributos `data-portal-sheet`, `data-portal-sheet-title`, `data-portal-sheet-filter` e `data-portal-sheet-column-header`, evitando seletores frágeis baseados na posição do elemento.

- barra de título e cabeçalho das colunas usam o mesmo verde institucional;
- planilha com filtro: **45 / 5 / 45 / 15 / 35 px**;
- planilha sem filtro: **45 / 15 / 35 px**;
- linha de dados com mínimo de **30 px**;
- paginação de **24 px**;
- controle do cabeçalho de **15 × 15 px**;
- primeira linha fixa nas tabelas;
- primeira coluna fixa, incluindo cabeçalho e corpo;
- exceção estrutural da Área do Presidente: Seleção + Processo ficam fixos e contíguos;
- texto padrão preto;
- botões comuns brancos;
- controles de configuração do cabeçalho são menores e em cinza muito claro;
- paginação é branca;
- mesmas regras de densidade, bordas internas, rolagem e sticky;
- não criar variante visual específica para uma tela.

## 10. Containers e pop-ups

O próprio popup é a moldura principal. Uma caixa que apenas envolve outra caixa, sem função própria, deve ser removida.

Para listagens:
`popup → planilha`

Para editores:
`popup → seções funcionais → campos/controles`

Pop-ups com planilha não devem ter uma moldura lateral adicional em volta da tabela. O cabeçalho da planilha é parte direta da estrutura do popup.
