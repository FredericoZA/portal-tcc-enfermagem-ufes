# Portal TCC — Refatoração estrutural de UI e Configurações

Data de consolidação: 27/09/2026

## Princípio obrigatório

Esta rodada não deve ser implementada como coleção de overrides locais. As regras devem ser centralizadas em tokens, componentes e resolvedores semânticos reutilizáveis. Uma tela só pode divergir quando a semântica exigir.

## Paleta global de superfícies

Referência oficial: tela **Como Chegar**.

1. Nível base / branco-gelo: `#f1f5f9`.
2. Camada 1: `#e1e6e9`.
3. Camada 2: `#d5dce0`.
4. Camada final: `#ffffff`.
5. Cabeçalho institucional: `#005830`.
6. Ações / títulos intermediários: `#337959`, borda `#286a4d`.

Verde não deve ser usado como grande superfície de conteúdo; é reservado para cabeçalhos, títulos e ações.

## Regras semânticas globais

- Filtro, calendário e botão do processo devem consumir a mesma fonte de estado/cor.
- Defesa futura: amarelo/ocre fosco.
- Defesa realizada: verde fosco.
- Meus TCCs: Aluno, Banca, Avaliador e Visualizador têm quatro cores foscas distintas; a cor do processo é exatamente a cor do papel/filtro correspondente.
- Área do Presidente: pendente amarelo fosco; assinado verde fosco.
- Nenhuma cor fluorescente.
- Texto tabular normal permanece preto/alta legibilidade, independentemente de data ou status.
- Status nunca deve reduzir a opacidade da linha inteira.
- Sem emoji em conteúdo tabular.
- A bolinha de cor dos filtros aumenta aproximadamente 30%, sem alterar a dimensão do botão.

## Calendário e Lista de Defesas

- Sábado e domingo se fundem visualmente ao fundo da caixa do calendário: sem quadrado/célula destacada; apenas o número do dia permanece visível.
- A regra vale para qualquer mês.
- Evento do dia mostra em duas linhas:
  - linha 1: horário + título do trabalho;
  - linha 2: nome do(s) aluno(s).
- O calendário não repete a data dentro do evento.
- Clique em dia com defesa deve abrir de forma estável, sem consulta paralela/race condition.
- Lista de Defesas e calendário compartilham a mesma semântica de cor.
- Filtro `A DEFENDER` e `JÁ DEFENDIDAS` governa também a cor do processo.

## Meus TCCs

- Quatro papéis com quatro cores distintas e foscas: Aluno, Banca, Avaliador, Visualizador.
- Filtro e botão Processo usam a mesma definição canônica de cor.
- Texto da planilha permanece preto e regular.

## Configurações — hub

Seis barras, nesta ordem:

1. Personalização do Portal
2. Sincronização
3. Acesso
4. Modelos e Variáveis
5. Registros de Assinatura
6. Registro de Logs

Todas as barras usam o mesmo verde institucional/intermediário e texto/ícones brancos.

## Configurações — shell de pop-up

- Cabeçalho superior verde escuro.
- Separador branco estrutural de 16 px quando aplicável.
- Superfícies seguem a escala global branco-gelo → cinza claro → cinza mais escuro → branco.
- Botões de ação em verde ou branco conforme hierarquia.
- Quando o pop-up possui apenas uma planilha (Acesso, Assinaturas, Logs), não deve existir sidebar redundante nem subtítulo repetido.

## Sincronização

- Manter organização funcional atual, mas substituir grandes fundos verdes/azulados pela paleta global.
- Membros da Comissão: cabeçalho de tabela verde institucional, texto branco; remover linguagem azul.
- Integrações Asten, Google Drive/Workspace, Supabase e Vercel: preservar funcionalidade, compactar visual e revisar botões.

## Acesso

- É uma planilha, não um workspace de navegação.
- Abrir diretamente tabela com busca, filtros, rolagem e ações.
- Remover sidebar e títulos repetidos.
- Cabeçalho verde, corpo na paleta global.

## Modelos e Variáveis — navegação

Uma única sidebar externa no pop-up, nesta ordem:

1. Modelos
2. Documentos
3. E-mails
4. Formulários
5. Fluxo
6. Variáveis

Não deve existir uma segunda sidebar/navegação concorrente dentro do estúdio.

## Modelos

- A gestão de modelos documentais do Usuário Master vira a primeira seção da sidebar (`Modelos`).
- Não deve ocupar espaço fixo nas demais áreas.

## Documentos

- Corrigir visualização.
- Objetivo: prévia fiel à saída final, com variáveis preenchidas por dados de demonstração estáveis.
- Margens, cores, quebras de página e composição devem usar a mesma engine de geração sempre que tecnicamente possível.

## E-mails

- Editor de modelo com assunto, destinatários, variáveis, anexos, corpo rico, cabeçalho, imagens e rodapé.
- Pré-visualização deve ser fiel ao que o destinatário receberá.
- Agendamento/acionamento por fluxo só deve ser exposto se existir suporte real no backend; não criar controles fictícios.

## Formulários

- Evitar rolagem infinita com um card completo por campo.
- Lista de campos compacta.
- Apenas um campo aberto para edição detalhada por vez.
- Prévia permanece visível/sticky e atualiza durante a edição.
- Edição e formulário precisam permanecer no mesmo contexto visual.

## Fluxo

- Visão geral compacta das etapas sempre visível.
- Etapas em linhas/cards resumidos.
- Apenas a etapa selecionada expande ações, condições e detalhes.
- Reduzir espaços vazios e preservar drag/reordenação.

## Variáveis

- Remover `Sugestões inteligentes de normalização` como bloco permanente.
- Converter Descoberta, criação, duplicidades, mesclagem e limpeza em barra compacta de manutenção.
- A definição da variável é o conteúdo principal.
- Uma variável = uma definição canônica + aliases + tipo + formatação + mapa de usos.
- `Salvar e propagar` aplica formatação/definição a todos os artefatos suportados.
- Detectar duplicidades e permitir mesclagem auditável.
- Variáveis sem uso só podem ser removidas após comprovação de zero referências.

## Registros de Assinatura

- Abrir diretamente como planilha, sem sidebar redundante.
- Mostrar linha/colunas completas com scroll horizontal controlado.
- Ações ficam acessíveis, preferencialmente coluna sticky.
- Exibir apenas ações realmente suportadas pelo backend.
- Fixture de demonstração é permitida quando não houver registros reais, desde que não persista e não entre em estatísticas.

## Registro de Logs

- Abrir diretamente como planilha.
- Sem sidebar redundante.
- Separador superior branco de 16 px.
- Linhas compactas e botões de ação compactos.
- Preservar Backup, Restaurar, busca, filtros e auditoria.

## Personalização do Portal

- Nesta rodada: **somente reorganização/estética** seguindo a paleta e hierarquia já consolidadas.
- Não alterar a semântica dos controles nem ampliar efeitos de configuração global sem testes dedicados, pois o editor atualmente pode causar regressões visuais amplas.

## Outros requisitos históricos ainda válidos

- Como Usar: separador branco estrutural de 16 px depois do bloco de título/filtros; conteúdo detalhado por público.
- Fluxo do TCC: cartões/resultados alinhados e detalhados.
- Indicadores: painel analítico rico, sem métricas inventadas e com privacidade agregada; deve abrir sem erro.
- Tabelas operacionais: densidade compacta, texto preto, sem fade por status, sem emojis.
- Redimensionamento de colunas: preferência do usuário persiste; padrão publicado pelo Master funciona como default global sem apagar preferências pessoais.
- Replicar Portal: um único download agregado de modelos.

## Critério de pronto

Um item só recebe status **CONCLUÍDO** quando:

1. a causa estrutural foi tratada;
2. TypeScript passa;
3. testes de unidade/contrato relevantes passam;
4. build de produção passa;
5. regressões do restante do Portal não são detectadas;
6. quando publicado, o deploy e health check são confirmados.

Itens sem evidência suficiente ficam como **NÃO CONFIRMADO** ou **PENDENTE**, nunca como concluídos por aparência ou intenção.