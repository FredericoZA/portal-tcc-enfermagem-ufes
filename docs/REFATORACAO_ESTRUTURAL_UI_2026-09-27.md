# Refatoração Estrutural de UI — 27/09/2026

Este documento consolida as solicitações de homologação visual e de usabilidade feitas durante a revisão do Portal TCC. A regra desta rodada é **corrigir a causa no código e nos componentes compartilhados**, evitando correções locais que possam voltar a divergir.

## Princípios obrigatórios

1. Uma única fonte semântica para cores de status e vínculo (`portalSemanticTokens.ts`).
2. Uma única hierarquia de superfícies administrativas: **branco gelo → cinza claro → cinza mais escuro → branco**, com verde reservado a cabeçalhos e ações.
3. Filtros, calendário e pílulas de processo devem consumir o mesmo estado e o mesmo token de cor.
4. Texto comum de planilhas permanece preto, peso normal e sem opacidade por situação temporal.
5. Fins de semana do calendário são indisponíveis e se fundem visualmente à superfície inativa/externa da grade.
6. Pop-ups de uma única planilha não exibem navegação lateral redundante.
7. Configurações complexas usam navegação única; não pode haver duas barras laterais concorrentes.
8. Alterações na Personalização do Portal nesta rodada são somente visuais/organizacionais; não alterar a lógica dos controles sensíveis.

## Checklist funcional e visual

| ID | Solicitação | Critério de aceite | Situação inicial |
|---|---|---|---|
| CAL-01 | Sábado/domingo sem quadrado branco | Mesmo fundo das células vazias externas ao mês; somente número visível | Em execução |
| CAL-02 | Mais contexto nos eventos | 1ª linha: horário + título; 2ª linha: aluno(s) | Em execução |
| CAL-03 | Cores consistentes | A defender = amarelo fosco; defendida = verde fosco em filtro, calendário e processo | Em execução |
| CAL-04 | Texto da Lista de Defesas preto | Sem cinza/opacidade para registros passados | Em execução |
| CAL-05 | Navegação rápida resiliente | Troca rápida de mês sem erro global/race condition | Verificar regressão |
| FIL-01 | Bolinha dos filtros ~30% maior | Alterar somente o marcador cromático, não o botão | Em execução |
| FIL-02 | Fonte única de cor | Filtro e pílula usam o mesmo token semântico | Em execução |
| TCC-01 | Quatro cores por vínculo em Meus TCCs | Aluno/ocre, Banca/terracota, Avaliador/azul, Visualizador/violeta, todos foscos | Em execução |
| TCC-02 | Pílula = cor do filtro | Mesma cor exata para o mesmo vínculo | Em execução |
| TCC-03 | Texto preto/regular e sem emoji | Conteúdo tabular legível, sem envelhecimento visual | Verificar regressão |
| PRE-01 | Presidência pendente/assinada | Pendente amarelo; assinada verde; preservar lógica existente | Verificar regressão |
| CFG-01 | Seis barras verdes em Configurações | Mesmo verde; ícones/textos/descrições brancos | Em execução |
| CFG-02 | Paleta global nos pop-ups | Gelo → cinza claro → cinza → branco; verde em cabeçalhos/ações | Em execução |
| CFG-03 | Sincronização mantém 2 seções | Rodapé/identidade e Integrações/plataformas, sem azul/violeta estrutural | Em execução |
| CFG-04 | Acesso sem sidebar redundante | Abre direto na planilha de autorizados | Em execução |
| CFG-05 | Logs sem sidebar redundante | Abre direto na planilha compacta | Em execução |
| CFG-06 | Assinaturas sem sidebar redundante | Abre direto na planilha, com scroll horizontal seguro | Em execução |
| CFG-07 | Logs compactos | Menos padding vertical; ações não aumentam artificialmente a linha | Em execução |
| CFG-08 | Assinaturas com ações válidas | Somente ações suportadas pelo backend/estado; não inventar excluir/aceitar/editar | Em execução |
| MOD-01 | Uma única navegação em Modelos e Variáveis | Sidebar externa: Modelos, Documentos, E-mails, Formulários, Fluxo, Variáveis | Em execução |
| MOD-02 | Modelos compactos | Gestão de modelos sem cards gigantes e com ação de adicionar clara | Em execução |
| DOC-01 | Prévia fiel do documento | Prévia usa dados fictícios estáveis e representa a saída final sem distorção | Avaliar capacidade real |
| EMA-01 | Editor de e-mail completo | Destinatários, assunto, variáveis, anexos, formatação, identidade e prévia fiel | Em execução / avaliar lacunas |
| FOR-01 | Construtor de formulário progressivo | Lista compacta + edição de um campo por vez + prévia contínua | Em execução |
| FLX-01 | Editor de fluxo compacto | Visão geral das etapas + somente etapa selecionada expandida | Em execução |
| VAR-01 | Remover sugestões passivas | Sem painel de “sugestões inteligentes” sem ação | Em execução |
| VAR-02 | Barra compacta de saneamento | Descobrir, duplicações, mesclar e limpar sem uso em poucos controles | Em execução |
| VAR-03 | Cadastro canônico | Definição, aliases, tipo, formato padrão, usos e propagação | Em execução |
| VAR-04 | Exclusão segura de variável sem uso | Excluir somente após confirmar zero referências | Em execução |
| PER-01 | Personalização somente estética | Aplicar a nova hierarquia visual sem mudar comportamento dos controles | Em execução |
| IND-01 | Indicadores funcionais | Página abre sem erro e mantém painel analítico existente | Verificar regressão |
| TAB-01 | Separador estrutural de 16 px | Fechamento de blocos superiores conforme padrão do Portal | Verificar/normalizar |
| TAB-02 | Redimensionamento persistente | Preferência do usuário persiste; padrão Master permanece global quando aplicável | Verificar |

## Restrições desta rodada

- Não criar operações de assinatura que o backend não suporte.
- Não alterar regras acadêmicas, datas, permissões ou fluxo operacional apenas para obter aparência desejada.
- Não alterar comportamento dos controles da Personalização do Portal; somente estética e organização.
- Não publicar se os testes obrigatórios falharem.
- Itens que dependam de engine inexistente (por exemplo, prévia PDF 100% idêntica ao gerador final) devem ser declarados **não confirmados** em vez de simulados como concluídos.

## Entrega

A entrega final desta rodada deve atualizar este documento com uma coluna de resultado (`CONSERTEI`, `NÃO CONSERTEI` ou `NÃO CONFIRMADO`) e evidência objetiva (arquivo/teste/checagem).