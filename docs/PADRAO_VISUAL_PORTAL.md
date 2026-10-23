# Padrão Visual Oficial — Portal TCC

Atualizado em 16/10/2026. Revisão 3.0. O PDF correspondente está em `output/pdf/padrao-visual-portal-tcc.pdf` e no Drive, dentro de `00_SISTEMA`.

Este documento registra os invariantes visuais do Portal. Eles devem ser reutilizados em todas as abas, tabelas, planilhas, pop-ups e áreas administrativas. Mudanças locais não devem criar uma nova paleta ou um novo padrão de espaçamento.

## 1. Hierarquia de superfícies

1. **Fundo geral da página:** branco-gelo `#f6f7f8`.
2. **Superfície principal de tela/planilha:** `#e9edef`.
3. **Blocos/células internas:** `#d8dfe3`.
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

- Fundo principal do pop-up: branco gelo `#f6f7f8`; painel cinza claro `#e9edef`; grupo interno cinza médio `#d8dfe3`; campos e linhas brancos `#ffffff`.
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

## Decisões de 16/10/2026

- Acesso, Registros de Assinatura e Registro de Logs são planilhas flutuantes: zero margem lateral; somente borda de 1 px e faixa branca de 15 px entre título e tabela. Estado vazio dentro da tabela, com colunas preservadas.
- Detalhes do TCC usa as quatro superfícies e o verde institucional `#005830`. Sem verde bebê ou roxo decorativo. Título em branco, resumo em cinza claro, grupos em cinza médio e controles brancos. Aba ativa e ações principais verdes.
- O texto escuro é `#0f172a`; o secundário é `#526273`.
- A raiz do Drive mantém Sistema, Documentos, Processos, Repositório Público e Lixo. Imagens e PDF visual pertencem a Sistema. Homologação fica em Sistema como configuração de testes.
- Os pilotos continuam identificados como fictícios. Reorganizar arquivos existentes não altera automaticamente a raiz de futuros envios do ambiente de homologação.
- O renderizador reproduzível do PDF é `scripts/documents/render-visual-guide.py`.

## Ajustes aprovados em 22/10/2026

- Rótulos, títulos, botões e estados usam capitalização normal. Siglas acadêmicas,
  protocolos e o conteúdo dos modelos documentais originais são preservados.
- No Repositório dos detalhes do TCC, campos e superfícies internas usam branco-gelo
  `#f6f7f8`, dentro dos grupos cinza médio. O botão final fica centralizado.
- Documentos indisponíveis mostram a razão na caixa amarela; Ver e Baixar ficam
  cinza e desabilitados. Quando liberados, Ver usa sálvia e Baixar usa verde escuro.
- Alterar data, horário ou local da defesa abre confirmação de atenção vermelha,
  informa o impacto no calendário e a obrigação de avisar e reconfirmar com o
  departamento. A alteração confirmada permanece registrada no histórico.
