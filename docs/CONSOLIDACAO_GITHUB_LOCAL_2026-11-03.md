# Consolidação da fonte e do acervo — 03/11/2026

A entrega solicitada usa o projeto `portal-tcc-enfermagem-ufes` e a base principal.
A homologação continua separada e seus dados não são copiados para a produção.

A fonte de preparação combina o checkout local preservado, cuja base é
`0e392dd4dee31d44ce2d6b12e2ddc21915450fdf`, com as alterações da manhã em
`origin/feat/ajustes-portal-20261103`, até `a8fa115`. Os arquivos adicionais do
pacote CLI anterior estão presentes; o guard de inventário de produção passou.
A versão 1.0.79 isoladamente não identifica essa consolidação.

Foram mantidos o repositório e os detalhes unificados para TCCs novos e legados,
a proteção de documentos privados, os bloqueios de etapa, os nomes completos dos
signatários, o fluxo de assinatura iniciado em Documentos administrativos e a
separação entre pedido de reserva com botões e cópia informativa aos autores.
Foram incorporados os recursos da manhã de informações gerais, feedback, zoom,
atualização por revisão remota, formatação de locais e identificação individual
nos documentos. O reagendamento usa a mesma transação existente para bloquear o
novo horário, preservar o histórico, invalidar a confirmação anterior e enviar
links novos de aceite/recusa. Não deixa uma proposta sem tratamento de resposta.

A atualização remota preserva campos em edição. O salvamento usa a revisão do
início da edição e recusa dados desatualizados, em vez de sobrescrever outra sessão.
Protocolo e criação continuam imutáveis.

Validação da fonte consolidada: TypeScript, 899 testes unitários, 17 testes de
contratos, 40 verificações de fluxo seguro, acessibilidade estática, contrato de
finalização, compilação e smoke HTTP aprovados. A auditoria npm de dependências
de produção retornou zero vulnerabilidades conhecidas. Conferência de navegador:
legados no mesmo detalhe, cinco cartões alinhados em desktop, layout móvel sem
transbordamento e sem exceções JavaScript nessas telas.

Importação concluída na base principal: somente os 102 registros históricos
validados. Os 411 processos demonstrativos locais não foram importados. Publicação dos PDFs
segue a autorização de origem: 50 registros autorizados, 50 recusados e dois
conflitantes mantidos restritos. Existem 49 referências de PDFs acadêmicos,
41 publicáveis e oito restritas, além de 64 documentos administrativos associados
que permanecem privados. Ausências históricas não geram documentos nem fatos novos.
A operação gravou a cópia de recuperação 8 na tabela privada de backups existente
(revisão 883), atualizou somente o catálogo para a revisão 884 e confirmou a
preservação de todos os outros campos do estado. Usuários, configurações e filas
da produção permaneceram iguais ao backup. A homologação não foi alterada.

Limites: a revisão não comprova ausência de toda vulnerabilidade possível nem uma
homologação completa dos provedores reais. O expurgo definitivo de envelopes Asten
continua dependente de contrato de API validado; não deve ser reportado como concluído.
A lista apresenta um estado de carregamento enquanto a consulta está pendente,
sem anunciar ausência de TCCs antes da resposta.
Os resultados efetivos da publicação e da importação ficam na evidência privada
`.portal-data/reconciliacao-2026-11-03/`, incluindo hash do pacote e ID do deploy.
