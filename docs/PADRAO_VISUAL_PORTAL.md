# Padrão Visual Oficial — Portal TCC

**Fonte de verdade visual da instalação UFES**  
**Versão 2.0 — 03/10/2026**

Este documento registra os invariantes visuais do Portal. A paleta é **protegida**: nenhum componente pode criar um novo cinza, verde estrutural ou tom de filtro fora deste contrato sem alteração explícita desta fonte de verdade.

## 1. Paleta canônica protegida

### 1.1 Estrutura e texto

| Token | HEX | Uso |
|---|---:|---|
| Superfície Nível 1 | `#F2F2F2` | fundo geral do Portal |
| Superfície Nível 2 | `#D9D9D9` | painel/corpo principal e corpo normal das planilhas |
| Superfície Nível 3 | `#B7B7B7` | primeira coluna congelada, barra superior e superfícies internas de terceiro nível |
| Superfície Nível 4 | `#FFFFFF` | controles brancos, inputs, paginação e quarto nível |
| Verde estrutural | `#006000` | barra de título, barra de filtro e cabeçalho das colunas |
| Seleção neutra | `#909090` | TODOS/TODAS selecionado e seleção neutra |
| Texto principal | `#000000` | texto e ícones sobre superfícies claras |

### 1.2 Navegação e rodapé

| Token | HEX | Uso |
|---|---:|---|
| Sidebar | `#011F17` | fundo integral da barra lateral |
| Rodapé | `#011F17` | fundo integral do rodapé |
| Navegação ativa | `#154C41` | item selecionado, divisores e controles internos escuros |

Estas cores fazem parte da mesma paleta protegida. A separação acima existe apenas para descrever o uso, não para criar uma categoria de cores “menos protegidas”.

## 2. Hierarquia obrigatória de superfícies

Ao colocar uma caixa dentro de outra, seguir sempre esta ordem:

1. **Nível 1 — `#F2F2F2`**: fundo geral.
2. **Nível 2 — `#D9D9D9`**: painel ou corpo colocado sobre o fundo.
3. **Nível 3 — `#B7B7B7`**: bloco interno adicional / primeira coluna congelada.
4. **Nível 4 — `#FFFFFF`**: conteúdo final, input, controle ou quarto nível.

Não pular níveis sem razão funcional. Não criar cinza intermediário.

## 3. Paleta oficial de filtros e status

A ordem abaixo é a ordem da referência aprovada:

| ID | HEX | Nome de referência |
|---|---:|---|
| F01 | `#982B15` | Marrom / terracota |
| F02 | `#BB271A` | Vermelho |
| F03 | `#DA954B` | Laranja |
| F04 | `#EAC451` | Amarelo |
| F05 | `#78A65A` | Verde |
| F06 | `#54808C` | Azul-petróleo |
| F07 | `#4B77D1` | Azul |
| F08 | `#5083C1` | Azul médio |
| F09 | `#634FA2` | Roxo |
| F10 | `#9B5277` | Vinho |

### 3.1 Distribuição semântica inicial

Para filtros com quatro vínculos, usar tons deliberadamente afastados:

- **Aluno:** F04 — `#EAC451` — amarelo.
- **Banca:** F03 — `#DA954B` — laranja.
- **Avaliador:** F07 — `#4B77D1` — azul.
- **Visualizador:** F01 — `#982B15` — marrom/terracota.

Estados de defesa:
- **A defender:** F04 — `#EAC451`.
- **Já defendida:** F05 — `#78A65A`.

Assinaturas:
- **Pendente:** F09 — `#634FA2`.
- **Assinada:** F06 — `#54808C`.

Filtros adicionais devem usar F02, F08 e F10 antes de repetir tons já ocupados. O objetivo é maximizar a separação visual entre categorias presentes na mesma barra.

## 4. Geometria canônica das planilhas

### 4.1 Planilha com filtros

```text
┌──────────────────────────────────────────────────────────────┐
│ 45 px  BARRA DE TÍTULO                         #006000       │
├──────────────────────────────────────────────────────────────┤ 5 px #FFFFFF
│ 40 px  FILTRAR: [TODOS] [CATEGORIA] ...         #006000      │
├──────────────────────────────────────────────────────────────┤ 15 px #FFFFFF
│ 35 px  CABEÇALHO DAS COLUNAS                   #006000       │
├──────────────┬───────────────────────────────────────────────┤
│ 30 px mín.   │ CORPO DA PLANILHA                               │
│ #B7B7B7      │ #D9D9D9                                        │
│ 1ª COLUNA    │ demais colunas                                  │
├──────────────┴───────────────────────────────────────────────┤
│ 24 px  PAGINAÇÃO INTEGRADA                    #FFFFFF        │
└──────────────────────────────────────────────────────────────┘
```

Bloco superior total: **140 px** = 45 + 5 + 40 + 15 + 35.

### 4.2 Planilha sem filtros

```text
┌──────────────────────────────────────────────────────────────┐
│ 45 px  BARRA DE TÍTULO                         #006000       │
├──────────────────────────────────────────────────────────────┤ 15 px #FFFFFF
│ 35 px  CABEÇALHO DAS COLUNAS                   #006000       │
├──────────────┬───────────────────────────────────────────────┤
│ 30 px mín.   │ CORPO DA PLANILHA                               │
│ #B7B7B7      │ #D9D9D9                                        │
│ 1ª COLUNA    │ demais colunas                                  │
└──────────────┴───────────────────────────────────────────────┘
```

Bloco superior total: **95 px** = 45 + 15 + 35.

### 4.3 Regras adicionais

- botão circular de ordenação/filtro por coluna: **15 × 15 px**;
- primeira coluna: sticky em cabeçalho e corpo;
- linha de dados: **30 px mínimo**, podendo crescer apenas se o conteúdo exigir;
- paginação: **24 px**, branca e integrada à planilha;
- controles comuns: branco `#FFFFFF`, texto preto, borda `#909090`;
- `TODOS/TODAS` selecionado: `#909090`;
- sem margens verticais extras em textos, botões e células;
- cabeçalho/filtro/colunas nunca recebem novos tons verdes.

## 5. Comportamento dos filtros

- Um grupo deve favorecer cores distantes entre si.
- Não usar dois azuis lado a lado se ainda houver amarelo, laranja, verde, marrom, roxo ou vinho livres.
- Filtro não selecionado: fundo branco; a cor da categoria aparece em bolinha/borda/contador.
- Filtro selecionado: pode preencher com a cor oficial da categoria.
- TODOS/TODAS é sempre neutro e usa `#909090` quando selecionado.
- O texto deve usar preto ou branco conforme o contraste do tom oficial; não criar outra cor de texto.

## 6. Barra superior, sidebar e rodapé

- barra superior geral: `#B7B7B7`;
- sidebar inteira: `#011F17`;
- rodapé inteiro: `#011F17`;
- item ativo da sidebar: `#154C41`;
- título/ícones da sidebar: branco;
- divisores internos escuros: `#154C41`.

## 7. Pop-ups e modais

- popup principal: Nível 2 `#D9D9D9`;
- seções internas: Nível 3 `#B7B7B7`;
- campos e controles finais: Nível 4 `#FFFFFF`;
- cabeçalho de popup: verde estrutural `#006000`;
- popup com listagem segue `popup → planilha`; não criar moldura externa redundante.

## 8. Implementação

A fonte de verdade no código é formada por:

- `src/utils/portalSemanticTokens.ts` — valores e semântica;
- `src/utils/siteLayoutConfig.ts` — header/sidebar/rodapé fixos;
- `src/portal-surface-contract.css` — contrato visual carregado por último.

Regras locais antigas podem continuar existindo por compatibilidade, mas não podem vencer o contrato final.

## 9. Checklist de homologação

- [ ] fundo geral = `#F2F2F2`;
- [ ] painel/corpo = `#D9D9D9`;
- [ ] primeira coluna/barra superior = `#B7B7B7`;
- [ ] branco final = `#FFFFFF`;
- [ ] verde estrutural = `#006000`;
- [ ] seleção neutra = `#909090`;
- [ ] texto principal = `#000000`;
- [ ] sidebar e rodapé = `#011F17`;
- [ ] item ativo = `#154C41`;
- [ ] filtros usam somente F01–F10;
- [ ] tabela com filtro = 45 / 5 / 40 / 15 / 35;
- [ ] tabela sem filtro = 45 / 15 / 35;
- [ ] botão de coluna = 15 × 15 px;
- [ ] primeira coluna sticky completa;
- [ ] paginação branca integrada;
- [ ] nenhum novo tom estrutural fora da paleta protegida.
