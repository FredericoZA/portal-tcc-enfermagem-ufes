# Correção de travamento progressivo ao navegar — 07/11/2026

Relato: uso repetido do Portal fica progressivamente lento, pode apresentar o fallback Não foi possível abrir esta tela, e melhora após F5. O responsável pediu correção do comportamento, preservando o fluxo normal.

## Defeitos reproduzidos e corrigidos

- O runtime global de planilhas mantinha um Map de hosts de tabelas de telas já desmontadas, com seus handlers e referências ao DOM. A limpeza só acontecia ao desmontar o aplicativo inteiro. A remoção agora libera hosts desconectados/fora da raiz e interrompe arrastes pendentes.
- O observador de alterações do aplicativo varria as tabelas também quando mudava um relógio, aviso ou texto de outra área. Agora essas alterações externas não disparam a varredura; texto/células e inserção/remoção de tabelas continuam atualizando a planilha.
- O redimensionamento de colunas mantinha pointermove/pointerup no documento caso a navegação removesse a tabela antes de soltar o ponteiro. Agora remoção, cancelamento do ponteiro, perda de foco, novo arraste e desmontagem liberam os eventos. A conclusão normal ainda grava a largura; cancelamento não grava preferência.
- Pop-ups de coluna com âncora removida são fechados e liberam seus eventos globais.
- A recuperação de arquivos de tela de uma publicação anterior usava a versão de pacote 1.0.79, igual em muitas publicações. Uma recuperação antiga bloqueava a de um novo código. O marcador passa a usar o commit da publicação, com limite de uma recuperação por identidade e proteção independente de storage. Somente falha de importação de módulo pode acionar essa recuperação, nunca gravações/validações.
- O espelho local das Configurações tinha leituras e gravações de storage sem proteção suficiente. Bloqueio ou falta de espaço local não devem derrubar a tela nem impedir a persistência oficial. A alteração específica é verificada separadamente nos testes.

Nenhuma alteração de etapa acadêmica, destinatário, documento, acesso, assinatura ou dados de produção é necessária para essas correções. Não foram adicionadas chamadas ao Supabase/Vercel nem repetição de gravações. A retenção de DOM é um problema no navegador; os timeouts de snapshots no banco continuam registrados separadamente, sem serem declarados resolvidos por esse reparo.

As verificações e a publicação exatas são registradas no comprovante TRAVAMENTO_PROGRESSIVO_PUBLICACAO.json de output/revisao-2026-11-07. O relato é acompanhado como MAN-006, sem marcar critérios amplos como concluídos por associação.

## Evidências de reprodução e regressão

O lifecycle real do componente, compilado e executado em VM, percorreu 100 remoções/inserções de tabelas iniciando arraste em cada uma. Com a correção, somente o host atual conserva três handlers e o documento/janela conserva apenas o arraste atual; desmontagem remove os restantes. Dez mutações de texto externas às tabelas não agendam frame, enquanto mutações na célula e adição/remoção de contêiner de tabela mantêm o refresh. Esses números são verificação determinística de referências/eventos; não são medição de heap/CPU em produção.

Os testes do redimensionador compilado verificam remoção durante drag, pointercancel, blur, substituição por novo drag e desmontagem sem escrita de preferência no cancelamento. Os testes de recuperação de módulo reproduzem duas publicações com a mesma versão 1.0.79, além de storage bloqueado e limite sem loop. Os testes de espelho local cobrem SecurityError, quota, falha de gravação preservando conteúdo e ausência de regravação quando o conteúdo já coincide.

Commits de implementação: 5d95c60a (identidade de publicação), d8fb055e (interações pendentes), 2a45803e (ciclo das tabelas e observação) e c0376efb (storage opcional). Nenhum teste alterou o fluxo de TCC ou os dados de produção.
