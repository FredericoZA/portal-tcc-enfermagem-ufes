# Arquitetura Visual Canônica — Portal TCC

**Status:** auditoria e especificação-base
**Base analisada:** main após 1.0.69
**Objetivo:** substituir a cascata de hotfixes por uma arquitetura visual única, mensurável e testável.

## 1. Diagnóstico da arquitetura atual

- 39 arquivos CSS em src/.
- 32 folhas CSS importadas diretamente por src/main.tsx.
- aproximadamente 294 KB de CSS em src/.
- 10 arquivos visuais centrais somam 1.109 ocorrências de !important.
- 6 runtimes/enhancers globais alteram o DOM após a renderização React.
- o histórico recente registra canonicalizações sucessivas nas versões 1.0.54, 1.0.56, 1.0.57, 1.0.65, 1.0.68 e 1.0.69, além de hotfix e rollback de paleta.

Conclusão: a mesma propriedade visual pode ser definida em mais de uma camada, com seletor e especificidade diferentes. O problema é arquitetural, não apenas cromático.

## 2. Paleta estrutural canônica

| Token | HEX | RGB | Uso permitido |
|---|---|---|---|
| surface.page | #F1F5F9 | 241, 245, 249 | fundo geral do site — somente nível global |
| surface.panel | #E1E6E9 | 225, 230, 233 | caixas grandes, planilhas, pop-ups e painéis |
| surface.card | #D5DCE0 | 213, 220, 224 | caixas internas dentro de painéis |
| surface.inner | #FFFFFF | 255, 255, 255 | quarto nível, controles, caixas internas finais e paginação |
| brand.header | #005830 | 0, 88, 48 | barra de título, cabeçalho de planilha e cabeçalho de modal/pop-up |
| brand.action | #337959 | 51, 121, 89 | ícones e ações verdes dentro de superfícies claras |
| chrome.sidebarFooter | #011F17 | 1, 31, 23 | sidebar e rodapé, obrigatoriamente iguais |
| chrome.active | #154D41 | 21, 77, 65 | item ativo da navegação |
| text.dark | #0F172A | 15, 23, 42 | texto principal escuro |
| text.light | #FFFFFF | 255, 255, 255 | texto sobre verde institucional |

### Hierarquia de superfícies
1. página = #F1F5F9;
2. painel grande = #E1E6E9;
3. card/caixa interna = #D5DCE0;
4. conteúdo interno adicional = #FFFFFF.

Nenhuma tela pode criar um quinto cinza estrutural.

### Barra institucional superior
Valor-base recomendado: #E1E6E9. Se a homologação pedir contraste adicional, a única alternativa admissível é #D5DCE0.

## 3. Paleta semântica atual de filtros — preservada

| Estado | Fundo | Borda | Texto |
|---|---|---|---|
| Defesa realizada | #BED8C3 | #719A79 | #23472B |
| A defender | #E8DDA7 | #B49D4F | #4A4020 |
| Aluno | #FDE68A | #D4A300 | #3F3000 |
| Banca | #FDBA74 | #EA580C | #431407 |
| Avaliador | #BBF7D0 | #16A34A | #14532D |
| Visualizador | #BFDBFE | #2563EB | #1E3A8A |
| Assinatura pendente | #D8C98F | #9B884B | #3E361C |
| Assinada | #C2D0C2 | #7E907E | #263728 |
| Neutro | #E2E8F0 | #94A3B8 | #334155 |

## 4. Geometria canônica de planilhas

### Tela com filtros
- barra de título: 45 px;
- separador branco título → filtro: 5 px;
- barra de filtros: 45 px úteis;
- separador branco filtro → cabeçalho: 15 px;
- cabeçalho das colunas: 35 px;
- linha de dados: 30 px mínimo;
- paginação: 24 px;
- controle circular de coluna: 15 × 15 px;
- botão de ação da barra de título: 30 × 30 px;
- padding horizontal da barra de título/filtro: 16 px;
- padding da célula: 4 px vertical / 8 px horizontal;
- raio do painel principal: 16 px;
- botões de ação: círculo completo.

Bloco estrutural antes dos dados: 145 px = 45 + 5 + 45 + 15 + 35.

### Tela sem filtros
- barra de título: 45 px;
- separador branco: 15 px;
- cabeçalho das colunas/dias: 35 px.

Bloco estrutural antes dos dados: 95 px.

### Sticky
- thead: position sticky; top 0; z-index 40;
- primeira coluna: position sticky; left 0; z-index 30;
- interseção primeiro TH: top 0; left 0; z-index 60;
- elementos sticky devem ter fundo opaco.
- Área do Presidente: Seleção = primeira coluna fixa; Processo = segunda coluna fixa.

## 5. Ordem e forma dos controles

Todos os botões de ícone da barra de título são circulares.

Ordem final à direita:
1. ações específicas da tela;
2. separação visual de 10 px;
3. busca;
4. configurações.

Busca e configurações formam o par final permanente, com 4 px entre os dois.
Exemplo do Repositório: [download] 10px [lupa] 4px [engrenagem].

### Paginação
- fundo #FFFFFF;
- altura 24 px;
- sem margem externa;
- Anterior, número e Próxima formam um conjunto compacto.

## 6. Contraste de ícones

Sobre barra verde:
- texto branco;
- ícone de identificação com fundo branco e pictograma escuro;
- botões operacionais claros e circulares.

Sobre superfícies claras:
- texto principal escuro;
- ícone de destaque com fundo #337959 e pictograma branco.

O Fluxo do TCC é a referência aprovada.

## 7. Arquitetura alvo

CSS alvo:
1. portal-tokens.css — cores, dimensões, z-index, radius e spacing;
2. portal-layout.css — shell, header, sidebar, footer e gutters;
3. portal-components.css — botões, cards, modais e controles;
4. portal-sheet.css — calendário e todas as planilhas;
5. portal-pages.css — apenas exceções semânticas realmente específicas;
6. portal-responsive.css — breakpoints.

A estrutura visual deve nascer dos próprios componentes React. Pós-processadores de DOM devem ser removidos à medida que suas responsabilidades forem absorvidas pelos componentes.

## 8. Plano de refactor

### Fase A — congelar o contrato
- registrar tokens e pixels;
- criar testes que proíbam novas cores estruturais hardcoded;
- criar testes para geometria, ordem de botões e sticky.

### Fase B — planilhas
- migrar as cinco superfícies para um componente/contrato comum;
- remover seletores por ID e :nth-child usados apenas para corrigir aparência;
- eliminar CSS legado de separadores, sticky e paginação.

### Fase C — shell
- unificar sidebar e rodapé em #011F17;
- definir barra UFES por token de superfície;
- centralizar ações da barra de título.

### Fase D — páginas e pop-ups
- aplicar hierarquia 1 → 2 → 3 → 4;
- refatorar Como usar, Indicadores, Fluxo, Configurações e pop-ups;
- remover caixas que não correspondam a uma camada semântica.

### Fase E — remoção de legado
- retirar imports portal-update-*, portal-version-*, hotfixes e overrides já absorvidos;
- reduzir !important ao mínimo;
- remover runtimes/enhancers DOM que ficaram sem função;
- executar regressão visual e funcional antes do merge.

## 9. Critério de conclusão

O refactor só está concluído quando:
- uma propriedade visual tem uma única fonte de verdade;
- todas as cinco planilhas compartilham o mesmo contrato;
- nenhuma nova cor estrutural aparece fora dos tokens;
- não existem separadores/paddings diferentes entre telas equivalentes;
- sticky funciona sem sobreposição;
- nenhum runtime precisa consertar visualmente um componente após o React renderizar;
- CI, CodeQL, build e regressão visual aprovam a mesma versão.