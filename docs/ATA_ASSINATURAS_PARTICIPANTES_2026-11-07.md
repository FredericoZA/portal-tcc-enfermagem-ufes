# Ata: uma página e assinaturas dos participantes

Solicitação de 07/11/2026: manter a ata em uma página, distribuir as assinaturas
lado a lado e solicitar a assinatura de todos os participantes da sessão.

| Coluna esquerda | Coluna direita |
| --- | --- |
| Orientador e presidente | Primeiro autor |
| Primeiro examinador | Segundo autor, se houver |
| Segundo examinador | Coorientador, se participou |

## Funcionamento

O orientador informa em Conceito e Ata se o coorientador participou, quando há
coorientador cadastrado. A escolha Sim/Não é obrigatória antes da prévia e do
registro. Não há inferência de presença pelo cadastro. A resposta faz parte do
vínculo da prévia; alterar a resposta exige conferir uma nova prévia.

As novas solicitações ASTEN usam orientador, dois examinadores e cada autor,
acrescentando o coorientador somente quando a presença foi confirmada. A regra
produz quatro a seis signatários simultâneos e continua usando os e-mails
cadastrados. Não há destinatários avulsos ou novos atalhos de envio.

O Gov.br exige a mesma lista completa. Um signatário vinculado ao TCC pode baixar
o original; a devolução/conferência continua limitada ao responsável autorizado.
Nenhuma permissão de registrar conceito ou administrar o processo foi ampliada.

## Documento e edição

As duas colunas usam tabulações nativas do Google Docs, preservando parágrafos
editáveis. Os nomes permanecem em negrito; funções ficam em peso normal. Nomes
longos quebram por largura medida, sem abreviar ou cortar palavras. O editor
espelha as duas colunas e preserva as tabulações ao salvar as correções.

A API do Google não permite escrever `ParagraphStyle.tabStops`. Por isso a
preparação ocorre numa cópia em memória dos bytes DOCX antes da conversão, sem
alterar o modelo ativo. Cabeçalhos, rodapés e imagens permanecem intactos. A
leitura de volta confere as tabulações herdadas em todas as linhas de assinatura.
Modelos Google Docs nativos precisam ter tabulações compatíveis já definidas.
Referência: https://developers.google.com/workspace/docs/api/reference/rest/v1/documents#ParagraphStyle

O limite é conferido no PDF efetivamente exportado, inclusive depois da edição.
Um PDF com mais de uma página é recusado antes do envio para assinatura. A
mensagem solicita revisão do texto/modelo, sem cortar conteúdo nem reduzir a
fonte do corpo automaticamente. Essa checagem não equivale a garantir que um
texto arbitrariamente longo caiba em uma página.

Ao salvar a cópia corrigida, a exportação e a verificação de página também
ocorrem antes de persistir o registro da ata. A falha descarta somente a cópia
da tentativa e preserva a prévia anterior, evitando concluir o registro com um
documento que não possa seguir para assinatura.

## Compatibilidade

Novos jobs ATA recebem `ataSignerPolicy: BOARD_AUTHORS_V1`. Solicitações já
emitidas sem o marcador conservam o contrato anterior de três docentes, sem
alteração do PDF, reenvio ou inclusão silenciosa de signatários. Quando for
necessário aplicar a nova regra a uma ata já registrada, utiliza-se a reabertura
formal existente. O documento só libera as próximas etapas quando todas as
assinaturas exigidas pela política da versão estiverem presentes.

A migração `20261107195901_signature_coadvisor_role.sql` acrescenta o papel
`CO_ADVISOR`. A leitura de volta confirmou a nova capacidade, a preservação de
todos os checks anteriores, RLS ativa e funções invoker com execução restrita
ao backend. Não houve criação de processo, assinatura ou e-mail em produção
para testar essa alteração.

Os testes cobrem composição mínima/máxima, ausência/presença do coorientador,
assinaturas incompletas, payload ASTEN com seis destinatários, Gov.br com seis
assinaturas, preservação de jobs anteriores, rollback e documento com duas
páginas recusado. A conferência visual do modelo oficial e o ciclo real de
assinaturas permanecem distintos desses testes; o comprovante de publicação
registra somente o que foi efetivamente observado.

## Conferência visual realizada

Foi usada uma cópia temporária do DOCX ativo, com dois autores, coorientador
presente e parecer de 179 palavras, aplicando os helpers do produto por chamadas
autenticadas do Google Docs. O PDF exportado pelo Google ficou em uma página A4.
A leitura de volta conferiu as seis linhas de nomes/funções e as tabulações
centrais herdadas. O PDF e a versão com numeração/marca de amostra foram
inspecionados visualmente: seis blocos lado a lado, sem corte ou sobreposição,
com brasão, cabeçalho e rodapé preservados. Essa é uma conferência documental;
não comprova um ciclo real de seis pessoas assinando pela ASTEN ou pelo Gov.br.

A cópia documental temporária foi movida para a lixeira recuperável. O modelo
ativo manteve tamanho/data de modificação, e o original local conferiu o SHA-256
`7af9b668e6b5651ce42feca077d74ff27e46e73d6a436fa625276b114ee1d923`.

Validação final do código: `npm run test:ci` aprovado com 1.546 testes unitários,
21 contratos, TypeScript, build, inicialização serverless e HTTP; fluxo seguro
40/40 aprovado. A prova de publicação fica no acompanhamento local, com o SHA
e o deployment efetivamente conferidos, sem presumir sincronização do GitHub.
