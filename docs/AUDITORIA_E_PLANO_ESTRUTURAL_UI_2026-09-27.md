# Portal TCC — Auditoria consolidada da rodada estrutural

Data: 27/09/2026
Branch: `refactor/global-ui-configuration-2026-09-26`
Release alvo: `1.0.47`

## Legenda

- **CORRIGIDO** — existe implementação estrutural e contrato/teste correspondente.
- **PARCIAL** — parte relevante existe, mas o requisito completo ainda exige trabalho adicional.
- **NÃO CORRIGIDO** — requisito levantado, mas não foi implementado nesta rodada.
- **NÃO CONFIRMADO VISUALMENTE** — código/testes passaram, mas não houve homologação pixel-a-pixel no navegador real.

## Matriz completa

| ID | Solicitação levantada | Estado | Implementação/evidência |
|---|---|---|---|
| CAL-01 | Sábado e domingo devem se fundir ao fundo vazio da caixa, sem célula branca útil | CORRIGIDO | `portal-semantic-ui.css` usa a mesma superfície para fim de semana/célula vazia; `HomePage` classifica fim de semana no React |
| CAL-02 | Evento do calendário: 1ª linha horário + nome do trabalho; 2ª linha aluno(s) | CORRIGIDO | `getDefenseCalendarSummaryParts` + `portal-calendar-defense-primary/secondary` |
| CAL-03 | Cor do processo na Lista de Defesas deve seguir exatamente o filtro/calendário | CORRIGIDO | `DefenseState` e tokens únicos `upcoming/defended` alimentam filtro, calendário e pílula |
| CAL-04 | A defender = amarelo fosco; já defendido = verde fosco; nada fluorescente | CORRIGIDO | `portalSemanticTokens.ts` concentra a paleta de defesa |
| CAL-05 | Troca rápida de mês não pode criar caminho assíncrono duplicado/race legado | CORRIGIDO | runtime não faz segunda busca de processos nem enriquece o calendário pelo DOM |
| TAB-01 | Texto das planilhas preto, peso normal e opacidade integral, inclusive após defesa | CORRIGIDO | formatador global + camada semântica CSS |
| TAB-02 | Remover emojis dos dados textuais tabulares | CORRIGIDO | resolvedor global de filtros/tabelas mantém `emoji: ''` |
| FIL-01 | Aumentar somente a bolinha cromática dos filtros em cerca de 30% | CORRIGIDO | classe global `.portal-filter-dot`; chip/botão não é redimensionado |
| TCC-01 | Meus TCCs: quatro cores foscas e distintas por papel | CORRIGIDO | tokens `student/board/evaluator/viewer` |
| TCC-02 | Cor do processo em Meus TCCs deve ser exatamente a cor semântica do filtro | CORRIGIDO | resolvedor semântico único por papel |
| PRE-01 | Presidência: pendente amarelo e assinado verde | CORRIGIDO | tokens `signature.pending/signed` compartilhados |
| CFG-01 | Seis barras da tela Configurações em verde, todas com texto branco | CORRIGIDO | `.portal-settings-title-bar` usa token verde global e força texto branco |
| CFG-02 | Ordem: Personalização, Sincronização, Acesso, Modelos e Variáveis, Registros de Assinatura, Registro de Logs | CORRIGIDO | estrutura da `ConfiguracoesPage` |
| CFG-03 | Logs e Assinaturas dentro de Configurações, sem depender de item lateral principal | CORRIGIDO | workspaces administrativos centralizados em Configurações |
| CFG-04 | Pop-ups: verde escuro no topo, branco gelo/cinzas nas superfícies, verde somente em título/ação | CORRIGIDO | tokens de superfície + `SettingsWorkspaceModal` + CSS semântico |
| CFG-05 | Eliminar azul/roxo como paleta estrutural dos pop-ups | CORRIGIDO ESTRUTURALMENTE | camada semântica neutraliza superfícies administrativas azuis/roxas; homologação visual ainda necessária |
| SYNC-01 | Sincronização: preservar organização, trocar fundos grandes para a paleta global | CORRIGIDO ESTRUTURALMENTE | workspace usa superfícies globais |
| SYNC-02 | Membros da Comissão deve seguir tabela do site: cabeçalho verde, corpo neutro | CORRIGIDO ESTRUTURALMENTE | paleta administrativa compartilhada; visual final ainda não homologado |
| SYNC-03 | Revisar botões Asten/Google/Supabase/Vercel | PARCIAL | componentes permanecem ligados às ações existentes e foram preservados; funcionamento real de cada provedor não foi revalidado ponta a ponta nesta rodada |
| ACC-01 | Acesso é uma planilha única: sem sidebar e sem repetir “Autorizações de Acesso” | CORRIGIDO | `SettingsWorkspaceModal` detecta `singlePane` e abre conteúdo em largura total |
| MOD-01 | Modelos e Variáveis deve ter uma única sidebar | CORRIGIDO | segunda navegação interna é ocultada; workspace externo controla a área |
| MOD-02 | Sidebar de Modelos e Variáveis: Modelos, Documentos, E-mails, Formulários, Fluxo, Variáveis | CORRIGIDO | seis seções explícitas na `ConfiguracoesPage` |
| MOD-03 | “Modelos Documentais do Usuário Master” vira área própria “Modelos” | CORRIGIDO | `MasterDocumentModelsPanel` foi deslocado para a primeira seção do workspace |
| DOC-01 | Documentos: seletor e edição do modelo | CORRIGIDO | editor existente preservado na seção Documentos |
| DOC-02 | Prévia fiel do PDF final com dados fictícios e mesma engine de geração | NÃO CORRIGIDO | a tela ainda informa que a aparência vem do DOCX e não renderiza o PDF final simulado dentro do Estúdio |
| EML-01 | Editor completo de e-mail: destinatário, CC/CCO, assunto, texto/HTML, imagens, cabeçalho/rodapé, anexos | CORRIGIDO | `IntegrationStudioPanel` já possui esses controles e iframe de prévia protegido |
| EML-02 | Pré-visualização visual fiel do e-mail | CORRIGIDO ESTRUTURALMENTE | usa o mesmo design salvo no editor para gerar `srcDoc`; envio real ainda precisa de homologação visual/cliente de e-mail |
| EML-03 | Agendamento por data/hora específica além do evento do fluxo | NÃO CORRIGIDO | o fluxo define o evento de disparo, mas não foi criada agenda temporal autônoma nesta rodada |
| FRM-01 | Formulários: parar a rolagem infinita; lista compacta + editar um campo de cada vez | CORRIGIDO | `selectedFormQuestionId`, lista numerada compacta e um editor de campo ativo |
| FRM-02 | Edição e prévia do formulário precisam permanecer juntas | CORRIGIDO | editor e prévia permanecem lado a lado; a lista compacta reduz a diferença de altura |
| FLW-01 | Fluxo: reduzir espaço e manter visão geral | PARCIAL | já existe “Leitura simples do fluxo” e controles preservados; cartões de edição ainda não foram convertidos para “somente uma etapa expandida por vez” |
| VAR-01 | Remover “Sugestões inteligentes de normalização” passivas | CORRIGIDO | painel deixou de ser renderizado |
| VAR-02 | Descoberta/mescla/manutenção em área compacta | PARCIAL | operações existem e foram preservadas, mas a faixa superior ainda ocupa mais espaço do que o formato compacto solicitado |
| VAR-03 | Uma variável canônica, evitar duplicação e reescrever referências na mescla | CORRIGIDO | `normalizeVariableKey`, descoberta, `mergeVariableAcrossArtifacts` e aliases |
| VAR-04 | Mostrar onde cada variável é usada | CORRIGIDO | `getVariableUsage` exibe documentos, e-mails e formulários vinculados |
| VAR-05 | Alterar variável e propagar para os usos | CORRIGIDO | `updateVariableAndPropagate` reescreve referências nos artefatos |
| VAR-06 | Excluir variável sem uso; bloquear se houver dependências | CORRIGIDO | exclusão consulta `getVariableUsage` e bloqueia quando há artefatos afetados |
| SIG-01 | Registros de Assinatura abrir direto como planilha, sem sidebar redundante | CORRIGIDO | workspace `singlePane` |
| SIG-02 | Linha completa, rolagem horizontal e ações visíveis | CORRIGIDO | tabela com largura mínima e ações sticky à direita |
| SIG-03 | Ações reais, sem inventar Editar/Excluir/Aceitar quando backend não suporta | CORRIGIDO | Detalhes/Reenviar/Reconciliar; reconciliação tem endpoint real |
| LOG-01 | Registro de Logs abrir direto como planilha, sem sidebar redundante | CORRIGIDO | workspace `singlePane` |
| LOG-02 | Logs com linhas mais compactas e botões sem aumentar altura | CORRIGIDO | paddings compactos cobertos pelo contrato v1048 |
| SEP-01 | Barra branca grossa de 16 px nos fechamentos estruturais | CORRIGIDO | padrão já existente e cabeçalhos dos workspaces usam separação de 16 px |
| PER-01 | Personalização do Portal: nesta rodada mexer só na estética, sem alterar lógica perigosa | CORRIGIDO NO ESCOPO | lógica dos controles não foi alterada; superfícies passam pela paleta global |
| PER-02 | Personalização ficar operacional/segura para uso futuro | NÃO CORRIGIDO | exige auditoria funcional específica dos controles; deliberadamente não acionada nesta rodada |
| IND-01 | Indicadores não pode quebrar | CORRIGIDO | contrato backend/frontend e tratamento defensivo cobertos por teste |
| IND-02 | Indicadores mais rico, com métricas/gráficos/comparações sem inventar dados | CORRIGIDO NA ESTRUTURA EXISTENTE | painel denso e métricas existentes são testados; ampliação futura depende de dados reais adicionais |
| USE-01 | Como Usar detalhado por público e com padrão de separador | CORRIGIDO EM RODADA ANTERIOR | estrutura detalhada preservada; esta rodada não reescreveu a tela |
| FLOW-01 | Fluxo TCC detalhado/padronizado com alinhamento dos resultados | CORRIGIDO EM RODADA ANTERIOR | contrato existente preservado |
| REP-01 | Replicar Portal com cards alinhados e um único ZIP agregado | CORRIGIDO EM RODADA ANTERIOR | contrato existente preservado |
| COL-01 | Redimensionamento de colunas por usuário; padrão do Master global | CORRIGIDO | configuração pessoal + configuração global do Master já possuem contratos automatizados |

## Pendências reais após esta rodada

1. **DOC-02** — construir prévia interna fiel do PDF final usando o mesmo pipeline de geração, com fixture determinística e sem alterar o modelo original.
2. **EML-03** — decidir e implementar agendamento temporal real caso ele deva existir além dos gatilhos do fluxo.
3. **FLW-01** — transformar a edição detalhada do fluxo em uma etapa expandida por vez.
4. **VAR-02** — compactar visualmente a faixa de manutenção de variáveis.
5. **SYNC-03** — homologar ponta a ponta cada integração real.
6. **PER-02** — auditoria funcional separada da Personalização do Portal.
7. **Homologação visual real** — validar em navegador as cores, dimensões, responsividade e estados com dados reais.

## Critério de publicação

A release só deve ir para `main` após CI, build, testes de segurança e CodeQL aprovados. Itens marcados como **NÃO CORRIGIDO** não podem ser descritos como entregues.
