> A revisão abaixo é histórica (RC5). Na RC8, a checagem estática e a tentativa de galeria são registradas em `RELATORIO_VALIDACAO_RC8.md` e `HOMOLOGACAO_RC8.md`. A RC8 acrescenta linha de base visual explicitamente aprovada e comparação por pixel; sem Chromium e avaliação humana, nenhuma captura pode ser declarada aprovada.

# Relatório técnico de interface, acessibilidade e desempenho

Data da revisão de código: 8 de setembro de 2026  
Escopo: estrutura global, telas operacionais e build RC5  
Meta de acessibilidade: WCAG 2.2 nível AA

## Veredito

A estrutura global ficou mais resiliente para teclado, redução de movimento, telas estreitas e carregamento progressivo. A compilação de produção do frontend foi concluída e passou a gerar pacotes separados por tela. Este documento é uma revisão técnica de código: não substitui uma auditoria visual completa, porque não houve captura válida do portal renderizado em desktop, tablet e celular nesta execução.

## Alterações verificadas

1. **Navegação inicial — saudável com ressalvas.** As telas são carregadas sob demanda com `React.lazy` e `Suspense`; o fallback tem estado anunciado por leitor de tela.
2. **Detalhes do TCC em modal — melhorado.** O contêiner recebeu semântica de diálogo, nome acessível, foco inicial, fechamento por `Escape` e devolução do foco ao elemento que abriu o processo.
3. **Navegação por teclado — melhorada globalmente.** Controles interativos recebem foco visível de alto contraste, inclusive quando componentes antigos removem o `outline` padrão.
4. **Preferências do sistema — melhoradas.** `prefers-reduced-motion`, `prefers-contrast` e `forced-colors` têm tratamento explícito.
5. **Reflow móvel — melhorado com ressalvas.** O portal estabelece largura mínima de 320 px, conteúdo multimídia fluido, quebra de palavras e formulários sem zoom automático em iOS. Tabelas extensas continuam usando rolagem horizontal intencional.
6. **Alvos de toque — melhorados.** Em dispositivos de ponteiro impreciso, botões e controles equivalentes recebem área mínima de 44 × 44 px.
7. **Desempenho — aprovado no build do frontend.** O Vite produziu chunks independentes para páginas, incluindo `ConfiguracoesPage` (379,82 kB brutos), `HomePage` (112,80 kB) e `ProcessoDetailPage` (103,28 kB), evitando colocá-las integralmente no carregamento inicial. A tela de Configurações permanece o maior chunk e deve ser fracionada em uma rodada posterior.

## Riscos remanescentes

- O Estúdio ainda contém textos funcionais de 9–10,5 px. Em interfaces densas isso compromete leitura e zoom; recomenda-se piso visual de 12 px para metadados e 14 px para conteúdo operacional.
- Há cabeçalhos de tabela acionáveis por clique sem semântica de botão e sem operação equivalente documentada por teclado. A ordenação deve usar um `<button>` dentro de `<th>` e anunciar `aria-sort`.
- O bloco expansível de localização no rodapé usa `<div onClick>`. Deve virar `<button>` ou `<details>/<summary>` com `aria-expanded`.
- O modal global de detalhes melhora a entrada e a saída de foco, mas não implementa confinamento completo de foco. Cada modal especializado precisa de teste e correção própria.
- Paletas definidas pelo Master podem criar combinações com contraste insuficiente. O editor visual deve calcular contraste antes de publicar e bloquear texto abaixo de 4,5:1 (ou 3:1 para texto grande e elementos gráficos essenciais).
- Tabelas com largura mínima de 900 px são navegáveis por rolagem, mas ainda precisam de ensaio a 200% e 400% de zoom para confirmar que ações e cabeçalhos permanecem identificáveis.

## Evidências e limites

- Confirmado: TypeScript não apresentou erro nos arquivos alterados nesta frente.
- Confirmado: `vite build` concluiu com 1.756 módulos transformados e chunks por página.
- Não confirmado: contraste real de todas as paletas configuráveis.
- Não confirmado: leitura por NVDA, JAWS, VoiceOver ou TalkBack.
- Não confirmado: fluxo completo somente por teclado e confinamento de foco em todos os pop-ups.
- Não confirmado: auditoria automatizada axe/Lighthouse e capturas em 320, 768, 1024 e 1440 px.
- A verificação TypeScript e o build integral foram concluídos depois da retirada do papel global de Coordenação. Permanecem apenas Master e Presidente da Comissão como administradores globais.
- Em 08/09/2026, o executável de automação de navegador não estava disponível. O artefato compilado iniciou e respondeu corretamente por HTTP, mas a inspeção visual renderizada em 320, 768, 1024 e 1440 px permanece **não confirmada**. Compilação, análise estática e smoke test HTTP não substituem essa homologação.

## Próxima validação recomendada

Depois que o servidor consolidado compilar, executar uma sessão visual com quatro larguras (320, 768, 1024 e 1440 px), zoom de 200% e 400%, navegação somente por teclado, modo de alto contraste e leitor de tela. Registrar capturas das telas pública, Meus TCCs, detalhe do TCC, Configurações, Estúdio e Central Asten. Só depois dessa etapa o projeto poderá afirmar conformidade visual; mesmo assim, conformidade WCAG exige testes manuais e automáticos combinados.
