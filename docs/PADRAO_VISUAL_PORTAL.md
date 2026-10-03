# Padrão Visual Oficial — Portal TCC

Este documento registra os invariantes visuais do Portal. Eles devem ser reutilizados em todas as abas, tabelas, planilhas, pop-ups e áreas administrativas. Mudanças locais não devem criar uma nova paleta ou um novo padrão de espaçamento.

## 1. Hierarquia de superfícies

1. **Fundo geral da página:** branco-gelo `#f5f5f5`.
2. **Superfície principal de tela/planilha:** `#e5e5e5`.
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
- Separador branco entre cabeçalho/filtros/conteúdo: **16 px**.
- O separador deve ter a mesma espessura em todas as telas.
- Evitar empilhar bordas adicionais sobre o separador de 16 px.

## 4. Botões

- Botão comum: fundo branco.
- Texto: escuro/preto.
- Borda: cinza neutro.
- Verde não deve ser usado indiscriminadamente em botões comuns.
- Verde é prioritariamente identidade institucional, barras, destaques e ações realmente principais.
- Estados acadêmicos podem usar suas cores semânticas próprias.

## 5. Pop-ups e modais

- Fundo principal do pop-up: `#e5e5e5`.
- Campos e cartões internos podem usar branco.
- Cabeçalho deve seguir a identidade institucional.
- Evitar padding vertical excessivo.
- Título deve permanecer centralizado quando o botão fechar estiver presente.
- Botões comuns dentro do pop-up continuam brancos; ação principal pode usar o verde institucional.

## 6. Densidade e espaçamento

- O Portal deve ser compacto.
- Evitar margens superiores e inferiores sem função.
- Evitar cabeçalhos altos.
- Evitar cartões com padding vertical excessivo.
- Inputs e botões devem manter altura consistente.
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


## 9. Contrato único de planilhas

Todas as planilhas do Portal usam o mesmo componente visual. O conteúdo e as colunas podem variar, mas a estrutura não.

- barra de título e cabeçalho das colunas usam o mesmo verde institucional;
- separador branco único de 16 px;
- primeira coluna fixa, incluindo cabeçalho e corpo;
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


## 11. Geometria canônica do topo das planilhas

A sequência visual é fixa e vale para todas as planilhas:

1. **Barra de título:** 45 px, fundo `#006030`.
2. **Linha branca:** 5 px.
3. **Barra de filtro:** 40 px verdes, fundo `#006030`.
4. **Separador branco:** 15 px.
5. **Cabeçalho das colunas:** 35 px, fundo `#006030`.

Altura total do bloco superior: **140 px**.

Nenhum componente local pode somar padding, margin ou border que altere essas medidas visuais.


## 12. Paleta estrutural canônica

A interface usa uma escala estrutural curta e memorável. Hexadecimais próximos foram normalizados para reduzir variações acidentais entre componentes.

| Token | Cor | Uso |
|---|---|---|
| `--portal-color-page` | `#F5F5F5` | fundo geral do Portal |
| `--portal-color-sheet` | `#F0F0F0` | corpo normal das planilhas e superfície operacional |
| `--portal-color-layer` | `#E5E5E5` | barra superior geral, primeira coluna congelada e camada estrutural mais forte |
| `--portal-color-white` | `#FFFFFF` | botões neutros, separadores, paginação e campos internos |
| `--portal-color-selected` | `#909090` | estado selecionado de filtros neutros |
| `--portal-color-border` | `#D0D0D0` | linhas e divisores neutros |
| `--portal-color-green` | `#006030` | barra de título, barra de filtro e cabeçalho das planilhas |
| `--portal-color-sidebar` | `#011F17` | barra lateral e rodapé |
| `--portal-color-text` | `#000000` | texto estrutural principal |

A barra lateral mantém desenho e comportamento aprovados. O rodapé adota o mesmo fundo principal `#011F17`, reduzindo uma cor estrutural do sistema.

### Hierarquia de superfícies

A ordem preferencial para caixas e camadas é:

1. página: `#F5F5F5`;
2. superfície funcional: `#F0F0F0`;
3. camada estrutural/primeira coluna: `#E5E5E5`;
4. superfície interna/controle: `#FFFFFF`.

Não criar um quinto nível de cinza. Se uma interface exigir mais níveis, a estrutura deve ser simplificada antes de introduzir outra cor.

## 13. Densidade

- textos internos: margem superior e inferior `0`;
- células de planilha: referência de `5 px` de padding vertical por lado;
- barras usam altura fixa, nunca margem/padding acumulado;
- botão de configuração de coluna: `15 × 15 px`;
- paginação integrada: `15 px`;
- evitar `py-2.5`, `py-3` ou maiores em tabelas, barras e filtros;
- preferir dimensões múltiplas de 5 sempre que possível.
