# Portal TCC — Auditoria consolidada da refatoração estrutural

Data: 27/09/2026  
Branch: `refactor/global-ui-configuration-2026-09-26`  
PR: `#77`  
Release alvo: `1.0.47`

## Princípio da rodada

Esta rodada substitui correções locais por contratos compartilhados: tokens semânticos de cor, superfícies administrativas, estado único de filtros/status, shell comum de Configurações e editores progressivos. Nenhum item abaixo deve ser considerado homologado visualmente apenas porque o código compilou.

## Legenda

- **CORRIGIDO** — implementação estrutural presente e validada pela suíte automatizada.
- **NÃO CONFIRMADO** — implementação existe, mas depende de provedor externo, navegador/dados reais ou homologação visual.
- **NÃO CORRIGIDO** — requisito pedido, mas ainda não implementado integralmente.
- **FORA DO ESCOPO FUNCIONAL POR SOLICITAÇÃO** — comportamento deliberadamente preservado; apenas estética foi tratada.

## Matriz solicitação → estado

| ID | Solicitação | Estado | Evidência/observação |
|---|---|---|---|
| CAL-01 | Sábado/domingo devem se fundir ao fundo vazio da caixa do calendário | **CORRIGIDO** | `portal-semantic-ui.css` aplica a mesma superfície às células externas e fins de semana |
| CAL-02 | Evento: linha 1 horário + título; linha 2 aluno(s) | **CORRIGIDO** | resumo estruturado em React e linhas limitadas para não estourar a célula |
| CAL-03 | Lista de Defesas, calendário e filtro devem usar exatamente a mesma cor de status | **CORRIGIDO** | estado `upcoming/defended` e tokens semânticos únicos |
| CAL-04 | A defender amarelo fosco; já defendido verde fosco; sem fluorescente | **CORRIGIDO** | paleta central em `portalSemanticTokens.ts` |
| CAL-05 | Navegação rápida entre meses sem corrida/caminho duplicado | **CORRIGIDO** | removido enriquecimento paralelo legado pelo DOM; estado React é autoridade |
| TAB-01 | Texto de tabelas preto, peso normal e opacidade integral, inclusive passado | **CORRIGIDO** | regra global de planilhas |
| TAB-02 | Sem emoji em conteúdo tabular | **CORRIGIDO** | normalização global preservada |
| FIL-01 | Aumentar somente a bolinha dos filtros ~30% | **CORRIGIDO** | `.portal-filter-dot`; chip não é redimensionado |
| TCC-01 | Meus TCCs com 4 cores foscas distintas por papel | **CORRIGIDO** | `student/board/evaluator/viewer` centralizados |
| TCC-02 | Botão do processo em Meus TCCs deve reproduzir a cor do filtro/papel | **CORRIGIDO** | mesmo resolvedor semântico alimenta filtro e pílula |
| PRE-01 | Presidência: pendente amarelo, assinado verde | **CORRIGIDO** | tokens `signature.pending/signed` |
| CFG-01 | Seis barras de Configurações verdes com texto branco | **CORRIGIDO** | barra compartilhada, inclusive Personalização |
| CFG-02 | Ordem das seis áreas administrativas conforme definido | **CORRIGIDO** | Personalização, Sincronização, Acesso, Modelos e Variáveis, Assinaturas, Logs |
| CFG-03 | Logs e Assinaturas dentro de Configurações | **CORRIGIDO** | workspaces administrativos centralizados |
| CFG-04 | Paleta global: gelo → cinza claro → cinza mais escuro → branco; verde em título/ação | **CORRIGIDO** | tokens de superfície + `SettingsWorkspaceModal` |
| CFG-05 | Remover azul/roxo como superfície estrutural dos pop-ups | **CORRIGIDO** | neutralização estrutural das superfícies administrativas |
| SYNC-01 | Sincronização seguir paleta global sem fundo verde dominante | **CORRIGIDO** | shell/superfícies compartilhadas |
| SYNC-02 | Membros da Comissão: cabeçalho verde, texto branco, corpo neutro | **CORRIGIDO** | linguagem tabular administrativa compartilhada |
| SYNC-03 | Conferir ações Asten/Google Drive/Supabase/Vercel | **NÃO CONFIRMADO** | ações foram preservadas e testes locais passam; validação ponta a ponta de cada provedor exige credenciais/ambiente real |
| ACC-01 | Acesso abrir direto como uma planilha, sem sidebar/títulos repetidos | **CORRIGIDO** | workspace `singlePane` |
| MOD-01 | Modelos e Variáveis com apenas uma barra lateral | **CORRIGIDO** | navegação duplicada removida |
| MOD-02 | Sidebar: Modelos, Documentos, E-mails, Formulários, Fluxo, Variáveis | **CORRIGIDO** | seis seções explícitas |
| MOD-03 | Modelos Documentais virar a seção própria “Modelos” | **CORRIGIDO** | catálogo deslocado para a primeira seção |
| DOC-01 | Documentos com seleção/edição do modelo | **CORRIGIDO** | editor preservado no workspace |
| DOC-02 | Prévia fiel do PDF final com dados fictícios usando a mesma engine oficial | **CORRIGIDO** | endpoint oficial de preview + `previewDocumentModel` + PDF.js em canvas; geração ligada ao mesmo pipeline do Google Drive, sem iframe externo |
| DOC-03 | Trocar modelo não pode mostrar resposta antiga/stale | **CORRIGIDO** | token de geração + vínculo ao `selectedDocId`; requisições antigas são descartadas |
| EML-01 | Editor de e-mail com destinatários, CC/CCO, assunto, HTML/texto, imagens, cabeçalho/rodapé e anexos | **CORRIGIDO** | controles preservados no Estúdio |
| EML-02 | Prévia do e-mail preencher variáveis com dados de exemplo e refletir o design salvo | **CORRIGIDO** | resolvedor determinístico cobre sintaxes atuais e legadas do portal |
| EML-03 | Agendamento por data/hora autônoma além dos eventos do fluxo | **NÃO CORRIGIDO** | hoje o envio é dirigido pelos gatilhos/fluxo; agenda temporal autônoma não foi implementada |
| FRM-01 | Formulários sem rolagem infinita; editar uma pergunta por vez | **CORRIGIDO** | lista compacta + `selectedFormQuestionId` |
| FRM-02 | Edição e prévia do formulário juntas | **CORRIGIDO** | editor/preview permanecem na mesma área, com detalhe progressivo |
| FLW-01 | Fluxo compacto, visão geral e somente uma etapa detalhada por vez | **CORRIGIDO** | `selectedWorkflowStageId`, Editar/Ocultar e detalhes condicionais |
| VAR-01 | Remover sugestões passivas de normalização | **CORRIGIDO** | painel passivo não é mais a interface principal |
| VAR-02 | Descoberta/mescla/manutenção em área compacta | **CORRIGIDO** | manutenção compactada e orientada a ações |
| VAR-03 | Uma definição canônica e mescla sem duplicar referências | **CORRIGIDO** | normalização e `mergeVariableAcrossArtifacts` |
| VAR-04 | Mostrar onde a variável é usada | **CORRIGIDO** | `getVariableUsage` |
| VAR-05 | Propagar definição/formatação para usos | **CORRIGIDO** | atualização/propagação reescreve referências |
| VAR-06 | Excluir variável somente com zero dependências | **CORRIGIDO** | exclusão bloqueia variável referenciada |
| SIG-01 | Registros de Assinatura direto como planilha, sem sidebar | **CORRIGIDO** | workspace `singlePane` |
| SIG-02 | Linha completa, scroll horizontal e ações acessíveis | **CORRIGIDO** | tabela larga + ações visíveis/sticky |
| SIG-03 | Somente ações que o backend suporta | **CORRIGIDO** | Detalhes/Reenviar/Reconciliar conforme estado |
| SIG-04 | Não permitir Reenviar quando criação Asten está `UNCERTAIN` | **CORRIGIDO** | UI bloqueia retry para evitar envelope duplicado |
| LOG-01 | Logs direto como planilha, sem sidebar | **CORRIGIDO** | workspace `singlePane` |
| LOG-02 | Logs compactos; botões sem inflar a altura da linha | **CORRIGIDO** | densidade tabular compacta |
| SEP-01 | Fechamentos estruturais com barra branca de 16 px | **CORRIGIDO** | contrato compartilhado de separadores/workspaces |
| PER-01 | Personalização: nesta rodada mexer apenas na estética | **CORRIGIDO NO ESCOPO** | paleta/layout organizados; comportamento sensível preservado |
| PER-02 | Tornar os controles de Personalização funcionalmente seguros | **FORA DO ESCOPO FUNCIONAL POR SOLICITAÇÃO** | usuário pediu explicitamente não alterar comportamento nesta rodada |
| IND-01 | Indicadores não pode quebrar | **CORRIGIDO** | contrato backend/frontend e tratamento defensivo |
| IND-02 | Indicadores mais densos sem inventar dados | **CORRIGIDO NA ESTRUTURA DISPONÍVEL** | métricas reais existentes; novas métricas dependem de novos dados confiáveis |
| USE-01 | Como Usar detalhado por público | **CORRIGIDO EM RODADA ANTERIOR** | preservado |
| FLOW-01 | Fluxo TCC público detalhado/padronizado | **CORRIGIDO EM RODADA ANTERIOR** | preservado |
| REP-01 | Replicar Portal com cards alinhados e um único ZIP agregado | **CORRIGIDO EM RODADA ANTERIOR** | preservado |
| COL-01 | Larguras por usuário e padrão global definido pelo Master | **CORRIGIDO** | persistência pessoal/global coberta pelos contratos existentes |

## Correções de qualidade descobertas durante a revisão

- Prévia documental deixou de depender de `iframe` externo incompatível com CSP e passa a renderizar o PDF em canvas.
- Prévia do documento é invalidada ao trocar de modelo e respostas assíncronas antigas não podem sobrescrever a seleção atual.
- Ao sair de uma seção de Modelos e Variáveis, o rascunho pendente é gravado sincronicamente antes do unmount, evitando perda da edição durante troca rápida de área.
- Resumos do calendário usam clamp explícito para respeitar a altura das células.
- Retry Asten é ocultado em estado de criação incerta para não incentivar duplicação de envelope.
- Workflows/scripts transitórios usados somente para materializar a refatoração foram removidos após o código final ser gravado.

## Pendências reais

1. **EML-03** — agendamento temporal autônomo por data/hora, se o produto realmente precisar disso além dos gatilhos do fluxo.
2. **SYNC-03** — homologação ponta a ponta de Asten, Google Drive, Supabase e Vercel em ambiente real.
3. **Homologação visual real** — conferir pixel a pixel, responsividade e comportamento com dados reais no navegador após publicação.

## Critério de publicação

Somente integrar à `main` quando CI, testes unitários/contratos/acessibilidade/finalização, build, HTTP smoke, CodeQL e checks de segurança estiverem verdes. Qualquer item dependente de ambiente externo ou homologação visual permanece explicitamente como **NÃO CONFIRMADO** até haver evidência.
