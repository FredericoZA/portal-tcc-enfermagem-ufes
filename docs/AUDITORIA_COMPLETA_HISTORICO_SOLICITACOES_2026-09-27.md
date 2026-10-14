# Portal TCC — Auditoria completa do histórico de solicitações

Data: 27/09/2026
Base auditada: `main` / Portal TCC `1.0.47`

## Princípio

Esta documentação consolida o histórico de solicitações de interface, usabilidade, configuração, persistência e integrações. A regra de implementação é estrutural: fonte única de verdade para paleta/status/filtros, componentes compartilhados, autosave e workspaces administrativos coerentes. Correções locais de CSS ou lógica paralela por tela não são consideradas solução definitiva.

## Legenda

- **CORRIGIDO** — há implementação estrutural identificável no código atual e/ou contrato automatizado existente.
- **PARCIAL / NÃO CONFIRMADO** — parte existe, mas falta validação real, ponta a ponta ou existe requisito histórico ainda não totalmente coberto.
- **NÃO CORRIGIDO** — requisito ainda não está integralmente implementado.
- **DELIBERADAMENTE NÃO ALTERADO** — o usuário pediu para preservar a lógica nesta rodada.

## Matriz completa

| ID | Solicitação consolidada | Estado atual | Observação |
|---|---|---|---|
| NAV-01 | Um único item ativo na barra lateral, com linguagem visual consistente | **CORRIGIDO** | `Sidebar` deriva o ativo apenas de `currentTab` |
| NAV-02 | Manter somente “Fluxo do TCC”; remover legado “Fluxo completo do TCC” | **CORRIGIDO** | apenas `fluxo-tcc` permanece no mapa atual |
| NAV-03 | Efeito 3D/faixa lateral do item ativo conforme referência histórica | **PARCIAL / NÃO CONFIRMADO** | classe estrutural existe; homologação visual pixel a pixel ainda necessária |
| SEP-01 | Uma única espessura/cor de divisória no portal, sem linha fina duplicada | **CORRIGIDO** | contrato compartilhado de separadores de 16 px e superfícies |
| TAB-01 | Texto normal das planilhas sempre preto, peso normal e opacidade total | **CORRIGIDO** | regra global em `portal-semantic-ui.css` |
| TAB-02 | Conteúdo tabular sem emojis decorativos | **CORRIGIDO** | normalização global preservada |
| TAB-03 | Toolbars/filtros compactos, sem padding vertical excessivo | **CORRIGIDO NA ESTRUTURA** | componentes compartilhados compactados; homologação visual final ainda recomendada |
| FIL-01 | Aumentar somente a bolinha colorida do filtro em ~30% | **CORRIGIDO** | `.portal-filter-dot`; chip não é redimensionado |
| SES-01 | F5 não deve derrubar sessão autenticada | **PARCIAL / NÃO CONFIRMADO** | `AuthContext` possui cache de identidade + retry; precisa teste real de refresh/cookie em produção |
| SES-02 | Timeout por inatividade coerente e atividade reinicia relógio | **NÃO CORRIGIDO / REGRA NÃO FECHADA** | histórico contém requisitos conflitantes (15 min vs permanecer 3 h); exige regra administrativa única antes de codificar |
| SAVE-01 | Rascunho/autosave de modelos, variáveis e Estúdio | **CORRIGIDO** | autosave local + flush no unmount no Estúdio |
| SAVE-02 | Autosave universal de formulário de usuário, avaliação e demais edições do portal | **PARCIAL / NÃO CONFIRMADO** | não foi comprovado de ponta a ponta em todos os módulos |
| TCC-01 | Meus TCCs: quatro cores foscas distintas (Aluno/Banca/Avaliador/Visualizador) | **CORRIGIDO** | tokens canônicos por papel |
| TCC-02 | Cor do processo deve ser exatamente a cor semântica do filtro | **CORRIGIDO** | filtro e pílula consomem o mesmo resolvedor |
| TCC-03 | Divisória/filtros compactos em Meus TCCs | **CORRIGIDO NA ESTRUTURA** | usa contratos globais atuais |
| TCC-04 | Botão “Novo TCC/Cadastrar” largo na toolbar | **PARCIAL / NÃO CONFIRMADO** | ação de criação existe no fluxo, mas a posição/visual histórico precisa homologação no navegador |
| TCC-05 | Regra de um TCC por aluno no backend | **PARCIAL / NÃO CONFIRMADO** | regra histórica; requer teste funcional/backend específico para confirmar integralmente |
| CAL-01 | Sábado/domingo devem desaparecer visualmente no fundo vazio da caixa | **CORRIGIDO** | weekend e célula externa usam o mesmo token de superfície, sem borda útil |
| CAL-02 | Evento no calendário: horário + título; segunda linha com aluno(s) | **CORRIGIDO** | resumo estruturado e clamped |
| CAL-03 | Calendário, filtro e Lista de Defesas devem usar o mesmo status/cor | **CORRIGIDO** | `upcoming/defended` centralizados |
| CAL-04 | A defender = amarelo fosco; já defendido = verde fosco; nunca fluorescente | **CORRIGIDO** | tokens semânticos únicos |
| CAL-05 | Troca rápida de mês sem corrida, DOM paralelo ou crash | **CORRIGIDO** | estado React é autoridade; enriquecimento paralelo removido |
| PRE-01 | Presidência: pendente amarelo, assinado verde | **CORRIGIDO** | tokens `signature.pending/signed` |
| PRE-02 | Asten/Gov individuais e em lote; toolbar compacta e ordenada | **PARCIAL / NÃO CONFIRMADO** | arquitetura existe; fluxo ponta a ponta Asten/Gov depende de ambiente/credenciais reais |
| CFG-01 | Tela Configurações com seis barras verdes, texto branco | **CORRIGIDO** | componente/tokens compartilhados |
| CFG-02 | Ordem: Personalização, Sincronização, Acesso, Modelos e Variáveis, Assinaturas, Logs | **CORRIGIDO** | ordem consolidada |
| CFG-03 | Logs e Assinaturas saem da lateral principal e ficam em Configurações | **CORRIGIDO** | centralizados em workspaces administrativos |
| CFG-04 | Paleta: branco-gelo → cinza claro → cinza mais escuro → branco; verde em títulos/ações | **CORRIGIDO** | tokens de superfície administrativos |
| CFG-05 | Remover azul/roxo como superfície estrutural dos pop-ups | **CORRIGIDO** | neutralização global das superfícies administrativas |
| SYNC-01 | Sincronização sem fundo verde dominante; usar paleta global | **CORRIGIDO** | shell e superfícies compartilhados |
| SYNC-02 | Comissão: cabeçalho verde/texto branco/corpo neutro | **CORRIGIDO** | padrão tabular administrativo |
| SYNC-03 | Remover duplicidade de gestão da Comissão e concentrar identidade/contatos | **CORRIGIDO NA ESTRUTURA** | configuração consolidada; homologação dos dados reais recomendada |
| SYNC-04 | Asten/Google/Supabase/Vercel compactos; Asten pode ter configuração mais rica | **CORRIGIDO NA ORGANIZAÇÃO** | layout consolidado; funcionamento externo ponta a ponta permanece **NÃO CONFIRMADO** |
| ACC-01 | Acesso deve abrir direto como planilha, sem sidebar/títulos repetidos | **CORRIGIDO** | workspace `singlePane` |
| ACC-02 | Cadastro individual nome/e-mail/matrícula/papel | **PARCIAL / NÃO CONFIRMADO** | interface existe; regras completas de papéis/origem precisam QA funcional |
| ACC-03 | Importação em lote/paste de planilha e classificação automática | **PARCIAL / NÃO CONFIRMADO** | não há evidência suficiente de homologação completa com XLSX/CSV real nesta auditoria |
| ACC-04 | Ativo/Inativo funcionar; exclusão com confirmação e sem destruir vínculos | **PARCIAL / NÃO CONFIRMADO** | exige QA funcional com registros reais/fictícios controlados |
| MOD-01 | Modelos e Variáveis com uma única navegação | **CORRIGIDO** | navegação duplicada removida |
| MOD-02 | Ordem interna: Modelos, Documentos, E-mails, Formulários, Fluxo, Variáveis | **CORRIGIDO** | seis áreas explícitas no workspace pai |
| MOD-03 | “Modelos documentais” vira seção compacta própria | **CORRIGIDO** | catálogo separado do editor de documentos |
| MOD-04 | Modelos sem limite estrutural de quatro; adicionar/remover/substituir e Drive | **PARCIAL / NÃO CONFIRMADO** | estrutura suporta coleção dinâmica; sincronização real com Drive precisa homologação |
| DOC-01 | Documento selecionável; visualizar variáveis e voltar ao Drive | **CORRIGIDO** | editor atual mantém seleção e link do Drive |
| DOC-02 | Prévia fiel do PDF final com dados fictícios e mesma engine oficial | **CORRIGIDO** | endpoint oficial + PDF.js/canvas |
| DOC-03 | Trocar modelo não pode exibir preview antigo/stale | **CORRIGIDO** | geração versionada/request token |
| DOC-04 | Substituição preservar formatação original do modelo | **PARCIAL / NÃO CONFIRMADO** | pipeline foi desenhado para preservar; precisa teste com DOCX oficiais variados |
| EML-01 | Editor completo: nome, destinatários, CC/CCO, assunto, corpo, HTML, imagens, cabeçalho/rodapé, anexos e variáveis | **CORRIGIDO** | editor atual cobre estes campos |
| EML-02 | Prévia extremamente fiel com dados de exemplo | **CORRIGIDO NA ESTRUTURA** | preview HTML protegido e variáveis determinísticas; cliente final real deve ser homologado |
| EML-03 | Associar e-mail ao fluxo | **CORRIGIDO** | ações do fluxo referenciam modelos de e-mail |
| EML-04 | Agendamento autônomo por data/hora além de gatilhos do fluxo | **NÃO CORRIGIDO** | envio atual é dirigido pelo fluxo; scheduler temporal independente não existe |
| FRM-01 | Criar/excluir formulários e perguntas, reordenar, tipos e variáveis | **CORRIGIDO** | construtor atual implementa estas operações |
| FRM-02 | Não ter rolagem infinita: lista compacta + uma pergunta editável por vez | **CORRIGIDO** | seleção progressiva por `selectedFormQuestionId` |
| FRM-03 | Editor e prévia juntos | **CORRIGIDO** | duas áreas sincronizadas |
| FLW-01 | Fluxo compacto; uma etapa detalhada por vez | **CORRIGIDO** | `selectedWorkflowStageId` |
| FLW-02 | Drag-and-drop de etapas, documentos, e-mails, formulários e ações | **CORRIGIDO** | handlers de drag/drop e paleta executável presentes |
| FLW-03 | Adicionar/remover/reordenar etapas e ações | **CORRIGIDO** | operações presentes no editor |
| VAR-01 | Catálogo canônico central de variáveis | **CORRIGIDO** | matriz única usada pelo Estúdio |
| VAR-02 | Remover painel passivo de “sugestões inteligentes” | **CORRIGIDO** | sugestão passiva não é renderizada |
| VAR-03 | Descoberta/mescla/manutenção compacta e acionável | **CORRIGIDO** | controles de descoberta e merge compactados |
| VAR-04 | Mostrar onde cada variável é usada | **CORRIGIDO PARA DOC/E-MAIL/FORM; PARCIAL PARA FLUXO** | mapa atual explicita documentos/e-mails/formulários; apresentação específica de uso no fluxo merece reforço |
| VAR-05 | Propagar nome/formatação canônica a todos os usos | **CORRIGIDO NA ARQUITETURA** | propagação e reescrita de referências presentes; homologar casos de formatação DOCX real |
| VAR-06 | Detectar/mesclar duplicadas com impacto antes da mescla | **CORRIGIDO** | impacto é calculado e confirmação é exigida |
| VAR-07 | Excluir variável somente se não houver dependências | **CORRIGIDO** | exclusão é bloqueada quando há usos |
| SIG-01 | Registros de Assinatura direto como planilha, sem sidebar | **CORRIGIDO** | `singlePane` |
| SIG-02 | Linha completa, scroll horizontal e ações acessíveis | **CORRIGIDO** | tabela larga e ações visíveis/sticky |
| SIG-03 | Somente ações que backend suporta | **CORRIGIDO** | Detalhes/Reenviar/Reconciliar conforme estado |
| SIG-04 | Evitar retry Asten quando criação está `UNCERTAIN` | **CORRIGIDO** | proteção contra envelope duplicado |
| LOG-01 | Logs direto como planilha, sem sidebar | **CORRIGIDO** | `singlePane` |
| LOG-02 | Linhas compactas e botões sem inflar altura | **CORRIGIDO** | densidade compacta compartilhada |
| PER-01 | Personalização: nesta rodada mexer somente em estética/organização | **CORRIGIDO NO ESCOPO** | comportamento sensível foi preservado deliberadamente |
| PER-02 | Remover controles/áreas obsoletos e tornar preview fiel ao Portal real | **PARCIAL / NÃO CONFIRMADO** | limpeza e estética avançaram; homologação visual completa do editor ainda falta |
| PER-03 | Tornar todos os controles da Personalização funcionalmente seguros | **DELIBERADAMENTE NÃO ALTERADO** | pedido explícito foi não mexer na lógica sensível nesta rodada |
| IND-01 | Indicadores não pode quebrar | **CORRIGIDO** | contrato defensivo backend/frontend |
| IND-02 | Indicadores mais ricos sem inventar dados | **CORRIGIDO NA ESTRUTURA DISPONÍVEL** | métricas adicionais dependem de dados confiáveis ainda não coletados |
| USE-01 | Como Usar detalhado por público | **CORRIGIDO EM RODADA ANTERIOR** | preservado |
| FLOWPUB-01 | Fluxo público detalhado/padronizado | **CORRIGIDO EM RODADA ANTERIOR** | preservado |
| REP-01 | Replicar Portal: cards alinhados e um ZIP agregado | **CORRIGIDO EM RODADA ANTERIOR** | preservado |
| COL-01 | Larguras pessoais; padrão global definido pelo Master | **CORRIGIDO** | persistência pessoal/global coberta pelos contratos atuais |
| QA-01 | QA com dados fictícios abrangendo todos os perfis/fases/assinaturas/publicação | **PARCIAL / NÃO CONFIRMADO** | há infraestrutura/testes; não há evidência suficiente de uma homologação visual completa de todos os cenários em produção |
| QA-02 | Auditoria de responsividade/acessibilidade/overlap/CSS/permissões/uploads/endpoints | **PARCIAL / NÃO CONFIRMADO** | testes automatizados existem; inspeção integral real no navegador e provedores externos continua necessária |

## Pendências que continuam reais

1. **EML-04** — scheduler autônomo de e-mail por data/hora, se for mantido como requisito de produto.
2. **SES-02** — fechar uma única regra de timeout de inatividade, porque o histórico contém dois comportamentos incompatíveis.
3. **SYNC-04 / PRE-02** — homologar Asten, Google, Supabase, Vercel e Gov.br ponta a ponta com credenciais e dados reais.
4. **QA-01 / QA-02** — homologação visual real, responsividade e cenários completos com dados de teste controlados.
5. **VAR-04** — tornar explícito no mapa de dependências também o uso da variável em condições/ações do fluxo.
6. **PER-03** — segurança funcional dos controles de Personalização fica para uma rodada futura, conforme instrução expressa de não mexer na lógica nesta rodada.

## Critério de conclusão

Nenhum item dependente de navegador real, credencial externa ou regra administrativa não definida deve ser marcado como “consertado” apenas porque a interface existe. Para esses itens, o estado permanece **PARCIAL / NÃO CONFIRMADO** até haver evidência ponta a ponta.
