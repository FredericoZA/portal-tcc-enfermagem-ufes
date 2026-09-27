# Portal TCC — Refatoração estrutural de UI e Configurações

Data de consolidação: 27/09/2026

## Princípio

As alterações desta rodada não devem ser implementadas como correções isoladas por tela. O Portal deve usar fontes únicas de verdade para paleta, status, filtros, superfícies, planilhas e workspaces administrativos. O restante do sistema deve permanecer inalterado.

## Regras globais

1. **Paleta de superfícies:** branco-gelo → cinza claro → cinza mais escuro → branco. Verde é reservado a títulos, cabeçalhos e ações.
2. **Paleta semântica:** filtros e elementos que representam o mesmo estado/papel usam o mesmo token de cor. Sem fluorescência.
3. **Planilhas:** texto comum preto, opacidade integral e peso normal; status nunca reduz legibilidade da linha.
4. **Filtros:** apenas o indicador circular de cor cresce ~30%; o botão não muda de tamanho.
5. **Configurações:** workspaces com uma única planilha não exibem sidebar redundante nem repetem subtítulos.
6. **Personalização do Portal:** nesta rodada somente estrutura/estética; não alterar a lógica dos controles sensíveis.

## Checklist funcional e visual

| ID | Solicitação | Solução estrutural definida |
|---|---|---|
| CAL-01 | Sábado/domingo iguais ao fundo vazio da caixa | fim de semana e célula externa ao mês usam o mesmo token de superfície |
| CAL-02 | Evento mensal mais informativo | linha 1 = horário + título; linha 2 = aluno(s) |
| CAL-03 | Lista de Defesas seguir cor do filtro/calendário | `DefenseState` único alimenta filtro, calendário e pílula |
| TAB-01 | Texto das planilhas preto inclusive após defesa | token global de texto; sem opacity por status |
| FIL-01 | Bolinha dos filtros ~30% maior | classe global do indicador, sem alterar o chip |
| TCC-01 | Meus TCCs com quatro cores distintas e foscas | `processRole.student/board/evaluator/viewer` compartilhado entre filtro e processo |
| CFG-01 | Seis barras da tela Configurações verdes e texto branco | mesmo token `portal-green-action` para todas |
| CFG-02 | Pop-ups na paleta global | superfícies canônicas, verde apenas em título/ação |
| CFG-03 | Sincronização manter organização e trocar fundos verdes/azulados | aplicar superfícies globais; cabeçalho de tabelas em verde |
| CFG-04 | Integrações e plataformas com mesma paleta | cards neutros e ações verdes, mantendo lógica existente |
| ACC-01 | Acesso abrir direto como planilha | workspace de seção única sem sidebar/subtítulo duplicado |
| MOD-01 | Modelos e Variáveis ter uma única sidebar | sidebar externa passa a conter Modelos, Documentos, E-mails, Formulários, Fluxo e Variáveis |
| MOD-02 | Modelos documentais como área própria | item Modelos abre gestão do catálogo documental |
| DOC-01 | Prévia fiel do documento final | prévia deve usar a mesma fonte de dados/engine do documento final e dados estáveis de exemplo |
| EML-01 | Editor completo de e-mails | assunto, destinatários, corpo rico, variáveis, anexos, layout e prévia fiel; agendamento só quando houver executor real |
| FRM-01 | Formulário não pode ser rolagem infinita | lista compacta + edição de um campo por vez + prévia persistente |
| FLW-01 | Fluxo muito espaçado | visão resumida de etapas + uma etapa expandida por vez |
| VAR-01 | Remover sugestões passivas | retirar painel de sugestões; manutenção vira barra compacta de ações |
| VAR-02 | Variável canônica, formatação e mapa de usos | uma definição por variável; propagação explícita; mescla e exclusão segura por dependências |
| SIG-01 | Registros de Assinatura abrir direto como planilha | seção única sem sidebar e sem título repetido |
| LOG-01 | Registro de Logs abrir direto como planilha | seção única sem sidebar e sem título repetido |
| LOG-02 | Tabela de logs compacta | densidade reduzida e ações não aumentam artificialmente a linha |
| SEP-01 | Separadores estruturais de 16 px | padrão compartilhado de fechamento do bloco superior |
| PER-01 | Personalização do Portal hoje é perigosa | apenas reforma visual nesta rodada; sem alterar comportamento dos controles |
| IND-01 | Indicadores quebrados e insuficientes | painel analítico precisa de camada de métricas e testes; não inventar dados |
| USE-01 | Como Usar sem barra estrutural correta | aplicar separador de 16 px no fim do bloco superior |

## Critério de conclusão

Um item só é marcado como concluído quando houver evidência no código e teste/CI correspondente. Mudança visual não verificada no navegador permanece **não confirmada** mesmo com build verde.
