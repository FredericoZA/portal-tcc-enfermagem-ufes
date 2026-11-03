# Correções acumuladas após a rodada 45

Não publicar no Vercel até o usuário concluir a revisão e autorizar uma nova
publicação. Não atualizar a cópia de release antiga nem executar seus scripts
de migração durante esta etapa.

## Ata padrão e rascunho

- Referência indicada: Google Doc `15RvjYczyurZU2b030DhbhRVFeYwdpt7_ngMXxUkAo14`.
  Era uma conversão temporária abandonada na raiz, com nome técnico de modelo ativo.
- O texto da referência corresponde ao DOCX original restaurado, incluindo
  cabeçalho, corpo e rodapé, descontando espaços de conversão. O catálogo de
  produção continua no original `1fsllAgip66pjCNvufTkrKmKbi9B06L3q`, versão 3.
- A diferença encontrada na aprovação vinha de `evaluationDrafts.documentText`:
  um texto de 1.816 caracteres do modelo rejeitado substituía o original na prévia.
- Correção local: vincular o texto integral editado ao arquivo e hash do modelo.
  Rascunhos de outro modelo perdem somente a substituição integral; respostas,
  resultado e parecer permanecem. A API recusa texto revisado sem a versão correta.
- Abrir o editor sem alterar texto não reescreve a ata. Revisões usam diferenças
  de texto e preservam os trechos/parágrafos inalterados, sem impor Arial 10,5 e
  justificação ao corpo inteiro.
- Durante a conferência o usuário concluiu a avaliação. O rascunho desse processo
  desapareceu e a avaliação concluída não continha `documentText`. Nenhum registro
  do processo, envelope ou documento assinado foi modificado nesta rodada.

## Drive: mudanças já executadas e conferidas

- Referência movida para `01_DOCUMENTOS/02_ATA_DEFESA/01_HISTORICO_MODELOS`,
  mantendo o ID e o link; nome: “Ata de defesa — referência original indicada em
  22-10-2026”.
- Cinco arquivos históricos identificados por finalidade: original, substituído,
  proposta descartada e revisão. Dois arquivos de identidade receberam nomes
  legíveis. IDs, conteúdos e permissões preservados.
- Raiz conferida novamente: somente `00_SISTEMA`, `01_DOCUMENTOS` e `02_PROCESSOS`.
- Pasta `00_SISTEMA/03_TEMPORARIOS_DOCUMENTAIS` preparada para as conversões,
  sem acesso público. Correção local dos chamadores de renderização para usá-la,
  inclusive nas futuras conferências de publicação; ainda depende de deploy.
- Pastas canônicas não foram renomeadas: o código publicado ainda as localiza
  pelo nome, e renomeá-las isoladamente poderia fazer o sistema criar duplicatas.
- Backups cifrados, modelos ativos, histórico e área técnica de homologação
  preservados. Nenhum arquivo excluído nesta rodada.

Inventário privado: `.portal-data/review-round46/drive-before.private.json`.
Registro das mudanças: `.portal-data/review-round46/drive-changes.private.json`.

## Validação local

- Testes específicos de rascunho, recuperação do modelo, acesso HTTP, edição do
  corpo e destino de conversões: aprovados.
- Fluxo seguro: 40 verificações aprovadas.
- Navegador em base isolada: aviso de restauração exibido, resultado aprovado e
  parecer mantidos. Uma edição do parecer foi gravada sem recuperar o texto
  integral rejeitado, com vínculo ao modelo atual. Nenhum processo de produção
  foi usado para esse teste.
- A base e o servidor isolados foram removidos após a conferência; a imagem de
  evidência foi preservada em `output/revisao-2026-10-22-rodada46/`.
- Validação geral: 625 testes unitários e 17 contratos aprovados; TypeScript,
  scanner de segredos, acessibilidade estática, finalização, build e smoke HTTP
  aprovados. Sem novo deploy, push ou alteração de credenciais de produção.

## Cartões dos documentos, alinhamento e disponibilidade

- Conteúdo de quem assina e da situação documental centralizado nos dois eixos.
- Disponível/assinado usa fundo verde claro; pendências permanecem amarelas e
  falhas de geração usam tom rosado, sempre com explicação textual.
- O controle Asten redundante e desativado deixa de aparecer quando o documento
  já foi encaminhado à assinatura, eliminando a caixa extra abaixo dos botões.
  Ações necessárias de assinatura ainda não encaminhada permanecem disponíveis.
- TypeScript aprovado; navegador conferido em base temporária isolada nos estados
  disponível e indisponível. Processo oficial e assinaturas reais preservados.
- Sem publicação no Vercel.

## Estrutura do Drive e suporte técnico separado (decisão confirmada pelo usuário)

- `00_SISTEMA` foi conferida com somente brasão, logomarca Colenf e PDF do padrão
  visual. Não é necessário excluir essa pasta institucional.
- Backups cifrados, relatórios e temporários foram movidos para fora do Portal,
  em `Portal TCC — Suporte técnico`, preservando IDs, arquivos e permissões nominais.
  A antiga raiz de homologação foi reaproveitada para esse destino; as quatro
  árvores antigas de teste estão em `04_ARQUIVO_DE_TESTES_ASTEN`.
- ID do destino técnico: `1j1_8TCUjo09I9AA2QSP9gcNIMp2Rv3bn`.
- Antes do próximo deploy: configurar no ambiente publicado
  `PORTAL_DRIVE_TECHNICAL_FOLDER_ID=1j1_8TCUjo09I9AA2QSP9gcNIMp2Rv3bn`.
  O novo código valida existência, escrita e privacidade, e não permite usar a
  própria raiz acadêmica como destino técnico. Sem configuração em produção,
  as operações técnicas falham explicitamente em vez de criar pastas em Sistema.
- A versão atualmente publicada ainda conhece o caminho antigo. Até publicar o
  novo código, rotinas agendadas podem recriar pastas técnicas em `00_SISTEMA`.
  Conferir novamente e consolidar eventuais arquivos novos antes da publicação.
- Dentro do processo oficial, `00_FORMULARIOS` ficou somente com cadastro inicial.
  O PDF histórico de confirmação do local foi preservado junto ao comprovante
  em `09_COMPROVANTE_RESERVA`, com ID e link inalterados.
- As três pastas antigas dos outros formulários e a pasta vazia do resumo expandido
  foram removidas do processo e arquivadas no suporte técnico. A conta conectada
  recebeu `insufficientFilePermissions` na exclusão definitiva; nenhum documento
  substantivo foi apagado. Não confundir arquivamento com exclusão.
- A rotina de organização deixou de pré-criar árvores de formulários e documentos:
  cada upload cria o destino que utiliza. Resumo expandido continua opcional.
  Formulários personalizados continuam permitidos quando efetivamente criados.
- Manifesto privado da conferência: `.portal-data/review-round48/drive-after.private.json`.

## Abas, visualização dos documentos e revisão local

- Ordem: Dados do processo, Avaliação e ata, Repositório, Documentos do processo.
- Processo concluído abre Documentos do processo, inclusive se a etapa antiga
  ainda indicar Repositório. A navegação manual entre as abas continua permitida.
- Visualização documental sem subtítulo do protocolo e sem faixa de versão,
  revisão de dados e status. O arquivo e as ações de correção/download permanecem.
- Menu Área do Presidente disponível tanto para Master quanto para Presidente;
  Configurações permanece com a condição anterior de acesso.
- Localhost recebeu 13 exemplos de TCC no mês atual, em dias úteis, identificados
  como demonstração. A inicialização repõe exemplos somente em base local vazia
  com flags explícitas de simulação, preservando configurações e bases preenchidas.
  Não há dados novos em produção nem envio externo nessa operação.
- Testes HTTP confirmam Presidência na própria fila e recusam aluno/visitante.

### Validação final da retomada

- `test:ci`: TypeScript, 633 testes unitários, 17 contratos, scanner de segredos,
  acessibilidade estática, contrato de finalização, build e smoke HTTP aprovados.
- Fluxo seguro: 40 verificações aprovadas.
- Base principal local: 13 processos persistidos, todos com defesa no mês atual.
  Presidência e Master acessam a fila (200); orientador e aluno são recusados (403).
- O preenchimento automático não invade bases isoladas com diretório explícito.
  O teste de upload de imagens confirmou que uma operação de imagem não cria TCCs.
- A inspeção visual nesta retomada não foi concluída: a ferramenta de navegador
  recusou adquirir a aba que estava em página de erro por política de URL.
  Não houve tentativa de contornar essa restrição; validação por API e testes.
- Build mantém aviso de bundles grandes já existente. Sem deploy/push.

## Cadastro como primeira etapa do fluxo

- Corrigida a ordem legada no navegador, no rascunho do Estúdio e na normalização
  da configuração: TCC_CREATED inicia o fluxo e as etapas são renumeradas.
- Preservados IDs, ações, condições e a ordem relativa das etapas seguintes.
- Os controles de mover não permitem deslocar o cadastro inicial para o fim.
- Conferência visual realizada no localhost: Cadastro inicial do TCC como etapa 1,
  confirmação do local como etapa 2 e conclusão como etapa 7.
- TypeScript e 30 testes de migração/configuração/execução do fluxo aprovados.
- Sem publicação no Vercel.

## Itens da etapa e campo do destinatário

- Botão de destinatário do e-mail em linha única, com rótulo curto e truncamento
  para valores longos; texto completo no título acessível ao passar o mouse.
- Removida a linha fixa e desmarcada “Ação interna do sistema” do catálogo.
  Ações existentes efetivamente configuradas continuam preservadas.
- Adicionado seletor “Adicionar item”: permite habilitar documentos, e-mails e
  formulários existentes ou abrir a criação de novo e-mail/formulário com campos.
- TypeScript e testes de consolidação de formulários/execução do fluxo aprovados.
- Navegador local: rótulo curto, ausência da linha fixa e opções de criação
  confirmados em aba auxiliar, encerrada depois. Sem deploy.

## Solicitação de reserva duplicada no catálogo de e-mails

- A atualização do Estúdio procurava a reserva apenas pela variável de destinatário;
  um endereço literal ou vazio fazia criar novamente `email-reserva` a cada abertura.
- O modelo passa a ser identificado primeiro pelo ID, sem depender do destinatário.
- Registros com o mesmo ID são consolidados; nomes iguais com IDs distintos
  permanecem. A lista anterior é preservada no armazenamento local de recuperação
  `portal_email_template_recovery_v1` antes da correção das repetições.
- TypeScript e 13 testes de identidade/migração/fluxo aprovados, incluindo cinco
  reaberturas simuladas com destinatário literal e vazio, preservação de anexos
  e vínculo da etapa sem repetir ações.
- No navegador: uma única opção `email-reserva`, inclusive depois de recarregar
  e reabrir o catálogo. Sem envio de e-mail ou deploy.

## Cabeçalho de e-mails

- Retirado o botão HTML e seu painel técnico opcional. Conteúdo HTML já salvo,
  editor de texto, variáveis e renderização/prévia permanecem preservados.
- TypeScript e diff aprovados; navegador confirmou o cabeçalho E-mails sem HTML.
- Sem deploy.

## Palavras-chave do repositório

- Grupo de hashtags centralizado na largura da caixa, inclusive com quebra de
  linha. Navegador confirmou cinco itens e `justify-content: center`.
- TypeScript aprovado. Sem deploy.

## Rodada 50 — publicação autorizada em 22/10/2026

O pedido mais recente autoriza revisar e publicar esta rodada no Vercel.

- Transporte central de e-mail do Portal bloqueia anexos PDF, inclusive nas
  novas tentativas de entregas antigas. Convite, assinatura e conclusão usam
  links autenticados para Documentos do processo, com e-mail de acesso e passos.
  Asten e Gov.br mantêm seus próprios canais de assinatura.
- Catálogo/editor remove escolhas de anexos. Textos/modelos personalizados e
  destinatários são preservados; configurações antigas não reativam anexos.
- Documentos indisponíveis ficam atenuados, com Ver/Baixar desabilitados.
  Corrigida uma regra CSS que deixava o botão Asten branco e sem texto visível.
- Como usar mantém estrutura única: fichário acessível por perfil, 7 atividades
  para aluno, 5 para orientação, 4 para presidência, 3 para visitante; imagens
  atuais demonstrativas e 20% menores no desktop, com link em tamanho maior.
- Indicador recebe código canônico da etapa; Assinaturas volta a marcar passo 6.
- Imagens capturadas em servidor auxiliar com base demonstrativa isolada.
  Nenhum cadastro, e-mail, envelope ou assinatura real foi disparado.
- Banco oficial lido pelo conector: revisão 251, somente o processo
  proc-1792437108150, aguardando dados finais. Nenhuma alteração de dados oficiais.
- Todas as tabelas públicas possuem RLS. Aviso informativo no inbox Asten sem
  política pública é compatível com acesso exclusivo do servidor.
- Auditoria npm: zero vulnerabilidades; fluxo seguro: 40 aprovados. Testes CI,
  compilação e smoke HTTP aprovados (logs privados da rodada 50).
- As credenciais remotas não foram copiadas para .env.local. A leitura direta
  com credencial antiga foi recusada; a conferência do banco usou o conector.
  Não constitui homologação de um novo envio real Gmail/Drive/Asten.

## Próxima publicação — pendências após a rodada 50

Aguardar novo pedido do usuário para publicar no Vercel. Os itens abaixo ainda
não foram implementados nem publicados.

- [x] E-mails: apresentar o acesso ao processo como botão clicável no HTML,
  seguindo as cores e o padrão visual do Portal. Usar rótulo descritivo de acordo
  com o destino, como “Acessar documentos do processo”, mantendo o link específico
  do TCC e da aba correspondente. Preservar a autenticação, as instruções e o
  e-mail de acesso do destinatário. Na versão de texto simples, manter o endereço
  como alternativa de acesso. Continuar sem anexar PDFs.

- [x] Ajuste local das prévias documentais: cabeçalho com nome do documento e
  código do TCC, sem título do trabalho; por exemplo, “Convite de banca
  examinadora · TCC-2026-0001”. Fundo intermediário removido do visualizador
  compartilhado e da prévia demonstrativa. Mantidos fundo claro e documento.
  A referência anterior com metadados e subtítulo era uma imagem antiga;
  esses elementos já estavam ausentes no código e não foram reintroduzidos.
  Pendente de publicação no Vercel, junto aos demais ajustes desta lista.

- [x] Rotina local de orientação da entrega final: após a ata assinada estar
  arquivada na revisão atual, enviar aos autores cadastrados (um ou dois) e ao
  orientador uma mensagem de ciência e instruções. Inclui ajustes eventualmente
  solicitados, resumo síntese até 2.000 caracteres, cinco palavras-chave, PDF
  final, resumo expandido opcional e escolhas independentes de publicação.
  O HTML possui botão para o TCC específico em secao=acervo; texto simples
  mantém endereço de acesso. Sem anexos. Asten e conferência Gov.br convergem
  para o evento SIGNATURE_COMPLETED; a rotina usa condição calculada no servidor
  e chave por processo/revisão/destinatário para evitar duplicar envio aceito.
  Modelo/ação ficam visíveis no rascunho do Estúdio; configuração antiga recebe
  a rotina no executor desse evento. Não há envio retroativo automático.
- [x] Texto local da opção de divulgação do resumo: “Tornar este resumo
  expandido público no Repositório Digital”. Mantida a autorização separada
  do trabalho completo, incluindo a possibilidade de divulgar apenas o resumo.
  Manual atualizado com a nova expressão. Pendente de publicar no Vercel.

- [x] Indicador local compartilhado de operações demoradas: painel de status
  com mensagem e barra animada, seguindo o fundo gelo e verde do Portal.
  Acompanha preparação, transferência e conferência de uploads do trabalho,
  resumo expandido, comprovante, modelos e devolução Gov.br; também cobre
  downloads e solicitações de gravação/prévias pela API principal.
  Mostra após 300 ms para evitar flashes em respostas rápidas; não estima
  porcentagens. Trata operações simultâneas e remove o indicador no sucesso
  ou erro. Respeita movimento reduzido e anuncia o status para leitor de tela.
  Inputs de upload e botão de finalizar bloqueados durante envio; comprovante
  mantém campos bloqueados durante confirmação. Verificação no navegador com
  respostas lentas/falhas interceptadas, sem enviar arquivos ou convites reais.
  TypeScript e 647 testes unitários aprovados. Pendente de publicar no Vercel.

## Rodada 51 — conclusão e publicação solicitadas

Pedido mais recente autoriza concluir e publicar todos os ajustes acima.

- E-mails do processo passam a ter botão HTML com destino autenticado por TCC
  e aba, inclusive quando o modelo só tem texto simples; CTA existente correto
  é preservado. Mantidos textos simples, instruções de acesso e ausência de PDFs.
- Corrigido bloqueio que aguardava escolha manual da presidência para gerar a
  declaração. O padrão é Asten, preservando opção explícita Gov.br. O destinatário
  continua vindo exclusivamente de commissionPresidentEmail das configurações.
- A declaração é normalizada para PUBLICATION_CLEARED e só pode ser gerada após
  ata arquivada, entrega final e termo aplicável assinado/arquivado. Ela também é
  obrigatória quando não houve publicação autorizada. A pendência de despacho
  Asten permanece registrada; não é apresentada como envio confirmado.
- Cartão do Termo informa “Não autorizado” após a entrega sem autorização de
  nenhum arquivo, explica a escolha e permanece atenuado, sem download/assinatura.
  Não confundir com entrega ainda não realizada ou retirada posterior de publicação.
- Mensagem de entrega confirma o recebimento, explica assinatura do termo quando
  aplicável e a responsabilidade posterior da presidência. Pendências técnicas
  não são ocultadas nem apresentadas como falha na entrega dos arquivos do aluno.
- Ata: o marcador legado da data final passa a incluir data e hora de encerramento
  calculadas como início + 60 minutos, em São Paulo. Nova variável disponível:
  ATA_ENCERRAMENTO_DATA_HORA. O horário real da assinatura digital não é alterado.
  Nenhuma ata/envelope já assinado nem modelo original foi reescrito.
- Prévia e cartão conferidos com respostas demonstrativas interceptadas no navegador,
  sem alteração da base nem envio real. Captura do Repositório atualizada no manual.
- test:ci aprovado: 652 testes na suíte principal, 17 contratos, TypeScript,
  acessibilidade estática, finalização, build e smoke HTTP. Fluxo seguro: 40/40.
  Auditoria de dependências: zero vulnerabilidades.

## Erros relatados após a publicação da rodada 51

Registrar os relatos para a próxima rodada. Não implementar nem publicar apenas
por receber uma anotação; aguardar pedido para executar as correções.

### Erro 01 — preparação da assinatura Gov.br pede novo acesso

- [x] Investigar e corrigir localmente a experiência de reautenticação ao preparar documento (publicação pendente).
- Relato de 22/10/2026 no ambiente publicado: pop-up “Assinatura gov.br”,
  processo TCC-2026-0001, ação “Preparar documento”.
- Mensagem observada: “Entre novamente antes de preparar a assinatura Gov.br.”
- Impacto relatado: o documento não é preparado e a pessoa recebe o erro dentro
  do pop-up. A captura não apresenta uma ação direta para renovar o acesso.
- Evidência fornecida pelo usuário:
  /var/folders/z7/dydknr1510xgkqm0y47pv9m40000gn/T/codex-clipboard-38e11866-02f3-4a41-90e5-5c5a0f319268.png
- Causa ainda não investigada. Conferir se a exigência de autenticação recente
  é esperada e como conduzir a renovação, preservando a proteção da assinatura
  e o contexto do documento. Não presumir que a sessão inteira expirou.
- Status: anotado; não reproduzido, não corrigido, sem novo deploy.

### Correção local do erro 01 — confirmação de acesso dentro da janela Gov.br

Implementação autorizada pelo usuário, com publicação no Vercel expressamente
adiada. A resposta 428/REAUTHENTICATION_REQUIRED agora abre confirmação por código
na própria janela, com ação para receber código no e-mail identificado pela sessão,
campo de seis dígitos, reenvio e mensagem de acesso confirmado. Não é preciso sair
nem localizar novamente o processo. Após confirmar, o usuário continua pela ação
original; operações sensíveis não são repetidas automaticamente.

- Mantida exigência de autenticação recente no servidor e verificação do usuário
  atual antes de validar o código. Código inválido deixa a confirmação aberta;
  ações documentais ficam bloqueadas enquanto a confirmação está pendente.
- Usa os endpoints OTP existentes e atualiza o contexto de autenticação, sem
  gravar códigos em localStorage, afrouxar prazo de autenticação ou fazer logout.
- TypeScript e 652 testes unitários aprovados. No navegador local, simulação de
  428, solicitação de código, rejeição de código inválido, código válido e retomada
  da preparação no mesmo processo. Respostas OTP e de assinatura interceptadas;
  nenhum e-mail enviado, nenhuma assinatura real ou arquivo oficial alterado.
- Status: código ajustado localmente; pendente de publicação, sem novo deploy.

Complemento do erro 01: após a confirmação válida, a ação “Confirmar acesso e
gerar documento” retoma uma única vez a preparação Gov.br que recebeu 428. Não
repete automaticamente upload, aprovação ou arquivamento. Conferido em navegador
com OTP e assinatura simulados: uma tentativa bloqueada, uma retomada válida e
botão Baixar original disponível no mesmo processo. TypeScript aprovado. Continua
somente local, sem publicação no Vercel.


### Erro 02 — alteração do e-mail da presidência volta ao endereço antigo

- [x] Investigar e corrigir localmente; publicação pendente, conforme pedido.
- Relato: em Rodapé e Identidade, editar o e-mail da Presidência mostrava o
  processamento e restaurava o endereço anterior.
- Evidência fornecida: `/var/folders/z7/dydknr1510xgkqm0y47pv9m40000gn/T/codex-clipboard-37573d16-f7eb-4f59-b7bc-523412e39654.png`.
- Causa no componente: o endereço sensível participava do salvamento comum;
  a atualização das configurações restaurava o endereço ainda ativo sobre o
  rascunho. O componente também tratava a solicitação de transferência como
  mudança concluída, sem explicar o aceite obrigatório do novo titular.
- Correção: separar os e-mails administrativos do salvamento comum, preservar
  rascunhos durante atualização e falhas, solicitar somente o papel editado e
  apresentar o novo endereço pendente junto do endereço ainda ativo. Reabrir
  a tela recupera transferências pendentes; há opção de cancelar a solicitação.
- Mantida a autenticação recente e a aceitação pelo novo titular no servidor.
  O endereço ativo só muda após entrar com o novo e-mail e aceitar a transferência.
- Verificação local: TypeScript e 652 testes unitários aprovados. Navegador com
  APIs interceptadas confirmou ausência de salvamento comum ao digitar o e-mail,
  preservação após erro simulado, nova tentativa com sucesso, manutenção do
  endereço pendente após atualizar a autenticação, cancelamento e recuperação
  da solicitação ao recarregar a tela.
- Nenhum e-mail/OTP enviado, nenhuma transferência real criada, nenhum cadastro
  de produção alterado. Sem push ou publicação no Vercel.

### Erro 03 — imagem do formulário ou e-mail exige entrar novamente

- [x] Correção local; sem publicação no Vercel.
- Relato: “Entre novamente antes de salvar imagens do Estúdio.” ao selecionar
  imagem em formulário ou e-mail.
- Evidência: `/var/folders/z7/dydknr1510xgkqm0y47pv9m40000gn/T/codex-clipboard-2c647158-6b95-44d2-baf5-961e9f0c71aa.png`.
- Causa: a API exige autenticação recente (428/REAUTHENTICATION_REQUIRED), mas
  o envio de imagem só exibia a mensagem e encerrava a operação.
- O envio agora usa a confirmação de identidade existente dentro do Portal:
  solicita código para o e-mail da sessão e, após validar, repete uma única vez
  o salvamento com a mesma imagem preparada, modelo, campo e revisão. Mantidas
  as validações, a proteção no servidor e a trava durante o envio.
- TypeScript e 652 testes unitários aprovados. Testado no navegador para e-mail
  e formulário: primeira tentativa com 428, confirmação por código e segunda
  tentativa bem-sucedida com corpo idêntico. Respostas de upload e OTP simuladas;
  nenhum código/e-mail enviado nem imagem real alterada no servidor.
- A correção ainda não está no site publicado.

### Clareza das assinaturas Asten/Gov.br no fluxo

- Configurações → Fluxos e a página Fluxo do TCC agora compartilham uma seção
  com a ordem das assinaturas, signatários, condições e local da escolha do método.
- Ata: somente orientador, após avaliação; entrega final depende de ata arquivada.
- Termo: orientador e todos os autores, após entrega quando houver publicação
  autorizada de ao menos um arquivo. Sem publicação, Não autorizado, sem assinatura.
- Declaração: presidência da comissão, por último, após resolver os documentos
  anteriores; endereço usado vem de Rodapé e Identidade.
- Asten explicitado como preferencial, com convite automático do provedor aos
  signatários. Gov.br continua disponível nos controles existentes, com devolução
  e conferência do PDF. Não foram criados modelos de e-mail Asten no Portal.
- As regras operacionais existentes de signatários/eventos foram conferidas no
  servidor; esta mudança esclarece as telas e não cria despachos ou altera jobs.
- TypeScript e 652 testes unitários aprovados. Navegador: três documentos nas duas
  telas; captura conferida visualmente; em 390 px a tabela permanece dentro da
  seção com rolagem horizontal. Sem envio real, push ou deploy.

### Posição da mensagem de processamento

- Indicador global de operação movido do rodapé para o centro vertical e
  horizontal da janela, preservando o aviso, a barra e a remoção ao concluir.
- TypeScript aprovado. Navegador com operação local simulada: centralização
  conferida em 1440 × 1000 e 390 × 844, sem ultrapassar a largura da janela;
  indicador removido ao concluir. Nenhuma chamada de gravação ou deploy.

### Conferência do destinatário Asten da declaração

- Relato: ao solicitar assinatura na Área do Presidente, a mensagem foi para
  Márcia; dúvida sobre endereço fixo ou uso do e-mail Master.
- Código conferido: a declaração deriva o signatário de commissionPresidentName
  e commissionPresidentEmail das configurações persistidas. Não usa masterEmail
  como destinatário alternativo. Ausência de e-mail da presidência bloqueia a
  geração. O envelope envia os signatários registrados no job documental.
- Não foi encontrado e-mail pessoal fixo no caminho de envio da declaração.
  Existem nomes/e-mails de exemplo em dados demonstrativos, sem participação
  nessa resolução do destinatário da presidência.
- Os 13 testes de política de assinaturas e conferência de declarações passaram,
  incluindo a verificação explícita de que Master e destinatários do pedido não
  substituem a presidência configurada.
- Esta conferência não identificou qual envelope ou valor das configurações
  estava ativo no momento do envio relatado em produção. Solicitações existentes
  preservam seus signatários; nenhuma foi alterada, cancelada ou reenviada.
- Sem alteração do cadastro real, envio Asten ou publicação no Vercel.

### Cartões documentais — texto, ordem das ações e verde existente

- Retirada da mensagem de Não autorizado a frase sobre não coletar assinaturas.
- Ações Asten, Gov.br e Continuar Gov.br posicionadas acima da linha Ver/Baixar
  PDF. Linha de visualização/download permanece no rodapé alinhado dos cartões.
- Disponível e Assinado usam portal-brand-sage, a mesma cor do botão Ver, com
  texto e borda nos tokens existentes; removido o verde claro específico.
- TypeScript e 652 testes unitários aprovados. Navegador local com respostas
  documentais simuladas: ações inferiores dos quatro cartões na mesma altura,
  provedores acima, frase ausente e igualdade da cor computada entre situação
  disponível/assinada e botão Ver. Captura conferida visualmente.
- Nenhuma alteração em documentos, assinaturas ou dados reais. Sem deploy.

### Repositório — alinhamento das caixas de arquivos

- Caixas do trabalho completo e resumo expandido compartilham as linhas de
  título, upload, informação do arquivo e autorização de publicação.
- A informação do arquivo mantém espaço vazio quando não há anexo; não adiciona
  aviso nem simula arquivo. O resumo expandido continua opcional.
- TypeScript aprovado. Navegador com arquivo de nome longo apenas à esquerda:
  uploads e escolhas Tornar público na mesma altura. Conferência em 390 px sem
  transbordamento, com caixas empilhadas. Captura visual conferida. APIs de leitura
  simuladas, sem envio de arquivo ou alteração dos dados. Sem deploy.

### Rodapé e Identidade — edição de vários dados em sequência

- Complemento ao erro 02: o salvamento comum permitia chamadas concorrentes por
  blur/temporizador e a hidratação de configurações sobrescrevia o rascunho de
  outros campos durante uma resposta lenta.
- Chamadas comuns agora são serializadas. A edição mais recente é preservada
  durante o salvamento/atualização e enviada após a primeira resposta, sem
  sobrescrever o rascunho com a versão anterior. Falhas mantêm os valores editados.
- Mensagens locais de Salvando alterações e Dados salvos, sem exibir confirmação
  de salvo para um rascunho que já mudou novamente. E-mails de acesso mantêm o
  fluxo separado de transferência/aceite; destinatário da declaração continua
  sendo commissionPresidentEmail, não masterEmail.
- TypeScript e 652 testes unitários aprovados. Navegador com servidor simulado
  lento: duas edições consecutivas, dois salvamentos, concorrência máxima 1,
  nome final da presidência preservado no campo e no estado simulado, nenhum
  e-mail administrativo incluído no salvamento comum. Sem alteração real ou deploy.

### Ordem dos modelos de e-mail na lista

- Lista do editor e catálogo de e-mails em Fluxos ordenados por: reserva,
  confirmação, convite, envio de ata/documentos e orientações de entrega no
  repositório. Modelos personalizados permanecem depois, na ordem em que estavam.
- Ordenação de exibição preserva os modelos, IDs, conteúdos e eventos de envio;
  não dispara mensagens nem muda a etapa operacional de envio de documentos.
- TypeScript aprovado. Navegador confirmou os cinco IDs e rótulos na sequência
  solicitada. Sem alterações na configuração real e sem deploy.

### Fluxos — três linhas operacionais Asten / Gov.br

- As ações documentais canônicas de Ata, Termo e Declaração agora são apresentadas
  no catálogo de Fluxos como Asten / Gov.br, com nomes de assinatura e vínculo
  explícito do destinatário. Reutilizam os mesmos IDs/actions; não geram ações
  adicionais nem envelopes duplicados.
- Destinatário da Ata: orientador do TCC; Termo: todos os alunos autores e
  orientador; Declaração: presidência ativa em Rodapé e Identidade. Endereços não
  são fixados no código e o detalhe de destinatário não substitui esses vínculos.
- A inclusão no editor só é permitida na etapa com o evento correto: avaliação,
  entrega do repositório ou liberação da declaração, respectivamente. O servidor
  mantém suas verificações e a escolha Asten/Gov.br por documento existente.
- O Fluxo do TCC também indica a origem cadastral de cada destinatário. No editor
  a célula fica em uma linha, com o caminho completo no tooltip/acessibilidade.
- TypeScript e 652 testes unitários aprovados. Navegador confirmou três linhas,
  com cada assinatura marcada na sua etapa e inclusão bloqueada nas demais.
  Nenhuma edição de responsáveis reais, encaminhamento de teste ou deploy.

## Rodada 52 — autorização final de publicação

- Pedido atual autoriza publicar o conjunto acumulado após a rodada 51.
- Manual: imagens com metade da largura anterior; abas contíguas de ponta a
  ponta, mesma superfície da folha e sem linha horizontal entre aba/conteúdo.
  Mantidos navegação por teclado, perfis e link para imagem maior.
- Explicação das assinaturas recolhida em observação clicável no editor Fluxos.
  Na página pública Fluxo do TCC fica aberta, abaixo do infográfico.
- Gov.br: área de devolução de PDF destacada, instruções de arquivo/limite e
  conferência; regras de validação estrutural e aprovação manual preservadas.
- test:ci aprovado com 652 testes e 17 contratos; fluxo seguro 40/40; auditoria
  npm de produção sem vulnerabilidades conhecidas. Ver revisão de segurança
  em REVISAO_SEGURANCA_RODADA_52.md.

Publicação da rodada 52 concluída: deployment dpl_J4qmHVPLNr5V1i5FtNKYFQLgQPqJ
READY, domínio oficial associado. Ajustes acima desta rodada publicados. Registro
completo em PUBLICACAO_2026-10-22_RODADA_52.md. Sem reenvio retroativo ou migração.

## Após a rodada 52 — explicação somente no fluxo público

- Retirada por pedido do usuário a observação Como funcionam as assinaturas
  Asten / Gov.br de Configurações → Fluxos, inclusive quando recolhida.
- Explicação preservada abaixo do infográfico no Fluxo do TCC público.
- Linhas operacionais Asten/Gov.br e vínculos de destinatários preservados.
- TypeScript aprovado; navegador confirmou ausência da explicação no editor,
  três linhas de assinatura e presença da explicação na página pública.
- Alteração local, ainda não publicada.

### Decisão do Master aplicada sem aceite de outro titular

- Pedido explícito substitui a regra anterior para decisões do MASTER_ADMIN.
  A API de alteração administrativa aplica imediatamente Master/owner ou
  Presidência/recuperação, sem OTP enviado ao destinatário nem aceite externo.
- Mantidas autenticação recente do Master, validação de e-mail, autorização no
  servidor, persistência durável e auditoria antes/depois. Outros perfis não
  recebem esse poder novo. Trocar o próprio Master remove a permissão do antigo.
- Solicitações antigas pendentes para o papel são canceladas, preservando o
  histórico, para não poderem substituir depois a decisão atual. A interface
  oferece Aplicar alteração para uma pendência anterior, sem executá-la sozinha.
- Tela confirma endereço atualizado e não cria painel de aceite para uma decisão
  concluída do Master. Nenhum e-mail ou responsável real alterado nesta rodada.
- Teste HTTP em base temporária: 401/403, e-mail inválido, troca imediata dos dois
  papéis, cancelamento de pendência, recuperação, auditoria persistida, permissão
  do novo Master e perda de permissão do anterior. Suíte: 653 testes aprovados;
  navegador confirma alteração imediata com respostas simuladas. Alteração local.

### Revisão pública solicitada após a rodada 52

- Replicar Portal reorganizado em oito caixas: GitHub, guia para IA, modelos,
  Vercel, Supabase, Google Workspace, Asten e Gov.br, numa única grade.
- Guia para IA atualizado para o fluxo atual, resumo em três parágrafos/2.000
  caracteres, vínculos de assinatura, Master direto, isolamento e critérios de entrega.
- Fluxo público: seção de assinaturas em cinza médio e textos centralizados.
- Como usar: texto à esquerda e imagem à direita em telas maiores; em telas
  pequenas mantém empilhamento. Tamanho da imagem preservado dentro da coluna.
- Indicadores: oito caixas menores passam do branco para o cinza dos demais cartões.
- TypeScript e 653 testes aprovados. Navegador confirmou oito cartões, colunas
  lado a lado, centralização e cinza médio igual nos oito indicadores.
- Pendência dos modelos de distribuição: os quatro IDs da API retornaram 404
  pelo conector Google Drive atual. Não é prova de exclusão nem de falha usando
  a conta Google do runtime. Os arquivos originais/assinados foram preservados;
  não foram substituídos por modelos fictícios. A atualização dos arquivos reais
  ainda depende de acesso à conta/pasta correta.

## Revisão de 23/10/2026 — acumular alterações, aguardar nova autorização Vercel

A instrução mais recente do usuário revoga a publicação imediata autorizada antes:
registrar os pedidos e publicar somente quando ele pedir novamente.

### Replicar Portal — uma única sequência de caixas

- Relato: o site publicado separa instruções/guia de IA e ferramentas, repetindo
  duas formas de explicar a replicação. Unificar em caixas com sequência lógica:
  código, guia para IA, modelos e preparação dos serviços da instalação própria.
- Uma grade de oito caixas já existe no código local; o screenshot recebido é da
  versão publicada anterior. Conferir clareza/ordem dessa grade na próxima rodada.
- Evidência: /var/folders/z7/dydknr1510xgkqm0y47pv9m40000gn/T/codex-clipboard-86aff388-c192-4f07-b2e9-1bcdc8ad6289.png.
- Não houve nova publicação no Vercel ao registrar esta anotação.

### Outros pedidos recebidos — registro anterior à execução da rodada 54

- Fluxos: lixeira deve excluir a linha inteira do item, com comportamento distinto
  de desmarcar Usar. Definir persistência e recuperação sem apagar indevidamente
  o modelo de documento/e-mail/formulário compartilhado em outras etapas.
- Histórico do TCC (ícone de relógio): conferir cobertura de alterações, inclusive
  data, hora e local, exibindo autor, momento, campos e valores antes/depois;
  disponibilizar download em PDF, respeitando as permissões do processo.
- Modelos de replicação: referências antigas deram 404. A pasta oficial foi
  localizada depois e contém modelos ativos. Ata/convite são DOCX; Termo e
  Declaração são Docs nativos. A API de distribuição ainda não foi atualizada.
- GitHub: snapshot enviado à branch codex/public-review53, PR 166 aberto. Push
  direto à main foi rejeitado pela regra de validação validate. Não afirmar
  atualização da main nem merge antes da confirmação dos checks e da integração.

### Erro 04 — conflito de revisão ao salvar imagem de e-mail/formulário

- Relato no ambiente publicado, em 23/10/2026: não consegue salvar imagem nos
  dois editores. Mensagem: O Estúdio foi alterado. Recarregue antes de salvar a imagem.
- Evidência: /var/folders/z7/dydknr1510xgkqm0y47pv9m40000gn/T/codex-clipboard-f5a99301-2b4e-4c32-a5c4-efc559e0fe4e.png.
- Diferente do erro 03 de autenticação recente: este relato corresponde ao
  conflito de revisão do Estúdio. Não presumir que a correção OTP já o resolve.
- [x] Reproduzir o conflito entre revisão local, atualização das configurações,
  salvamento automático e PATCH de imagem; considerar também duas abas.
- [x] Corrigir sem sobrescrever edição de outra sessão, perder rascunho ou imagem
  selecionada; manter controle de revisão no servidor.
- [x] Validar e-mail e formulário com conflito real/simulado, nova tentativa,
  confirmação de persistência e reabertura, além do caso de autenticação recente.
- Status atualizado: correção local executada e validada na rodada 54; sem novo deploy.

### Orientação no modelo de e-mail incorreto

- Usuário indicou que a observação da captura pertence ao e-mail de convite da
  banca, não ao e-mail de confirmação do local.
- Evidência: /var/folders/z7/dydknr1510xgkqm0y47pv9m40000gn/T/codex-clipboard-d842c143-c93a-4009-ac09-cf5c51a82011.png.
- A captura mostra orientações de conferência de dados pela orientação e de
  aguardar o convite pela banca. Conferir o trecho indicado, seu modelo/evento
  e a composição automática das orientações antes de mover o texto.
- [x] Realocar a observação indicada para o convite; manter na confirmação do
  local apenas as instruções pertinentes a essa etapa e seus destinatários.
- Status atualizado: orientação corrigida e testada localmente na rodada 54; sem publicação no Vercel.

## Execução consolidada em 23/10/2026 — rodada 54

O usuário determinou executar os pedidos, mantendo somente a publicação no Vercel
suspensa. A orientação anterior de apenas acumular anotações está substituída.

Foram executados o conflito de imagens, a exclusão persistente de linhas do fluxo,
o histórico real com PDF, a correção das orientações de e-mail e a atualização
da API dos modelos de replicação. Os ajustes visuais públicos anteriores foram
preservados e conferidos. Os estados históricos acima descrevem as rodadas em
que foram escritos; as pendências funcionais listadas foram tratadas nesta rodada.

Verificação: 662 testes unitários, 17 contratos, 40 verificações de fluxo seguro,
TypeScript, acessibilidade estática, build e smoke HTTP aprovados. A galeria local
gerou 70 capturas sem erros. Testes de navegador e HTTP confirmaram preservação
de rascunho/imagens, remoção e recuperação de linha e auditoria de agendamento.

Registro completo: [CONFERENCIA_LOCAL_2026-10-23_RODADA_54.md](CONFERENCIA_LOCAL_2026-10-23_RODADA_54.md).

GitHub e Vercel permanecem estados distintos: PR 166 aberto para revisão; os
alertas de segurança não foram encerrados. Não houve nova publicação no Vercel.

## Erro 05 — botão de olho bloqueia a prévia do modelo (rodada 55)

- Relato: Configurações → Documentos e Variáveis → olho apresenta “O modelo foi
  alterado diretamente no Google Drive. Revise e publique uma nova versão...”.
- Causa: a amostra administrativa utilizava o fingerprint da versão publicada,
  igual à emissão oficial. A prévia passa a capturar a revisão atual do Drive,
  usá-la somente no processo fictício `model-preview` e conferir a estabilidade
  dessa revisão antes/depois da renderização. Não atualiza o catálogo publicado.
- A emissão oficial mantém a conferência contra a versão aprovada. A revisão
  exclusiva da amostra é recusada para um processo real.
- Na conferência do navegador surgiu um segundo bloqueio: a política de conexão
  impedia a leitura do PDF temporário em URL blob. Servidor e configuração da
  Vercel passam a permitir essa origem interna para a prévia, sem liberar hosts
  arbitrários. A configuração da Vercel foi editada localmente, sem deploy.
- Navegador local com resposta de API simulada: um clique abriu a janela e
  renderizou uma página de PDF em canvas, sem alerta de carregamento. Rascunhos
  do navegador restaurados após a conferência. Nenhum arquivo real foi publicado.
- Validação: 663 testes unitários, 17 contratos, TypeScript, acessibilidade
  estática, finalização, build e smoke HTTP aprovados; fluxo seguro 40/40.
- Logs locais privados: `.portal-data/review55/`. O acesso aos modelos reais
  usando o runtime de produção não foi homologado nesta rodada.
- Status: corrigido no código local. Sem publicação no Vercel.

## Erro 06 — salvamento automático bloqueado nos pop-ups (rodada 56)

- Relato: E-mails, Documentos/Variáveis e Fluxos ainda mostram que a configuração
  não foi salva e aparentam depender do antigo botão Salvar.
- Causas confirmadas: a validação do pacote inteiro impedia a gravação de qualquer
  edição incompleta; o fechamento antes do debounce cancelava o envio ao servidor.
  Documentos/Variáveis tinha outro autosave com a mesma restrição, sem aviso claro.
- Correção: o modo de salvamento automático grava a edição incompleta no servidor
  em `integrationStudioDraft`, separado da configuração operacional válida. Ao
  completar os campos, a própria gravação valida e ativa a revisão, sem botão de
  Salvar/Publicar. O rascunho administrativo não é exposto na API pública.
- Os pop-ups compartilham fila de gravação, comparação com a revisão do servidor,
  preservação de mudanças independentes e reautenticação quando necessária.
  Fechar o pop-up envia a edição pendente. A abertura recupera também o rascunho
  do servidor, sem depender exclusivamente do localStorage do navegador.
- Documentos/Variáveis preserva as coleções não alteradas no pop-up e não precisa
  do botão removido. Imagens continuam sendo gravadas quando há rascunho incompleto.
- A confirmação informa “Alterações salvas automaticamente”. Se faltarem campos,
  informa que estão salvos e precisam ser completados; não os trata como perda de
  gravação. Erros reais de rede, permissão ou conflito continuam visíveis.
- O autosave usa indicação discreta no editor, evitando o painel central de
  processamento a cada edição. Uploads e outras operações mantêm o indicador.
- HTTP isolado: edição incompleta durável, recuperação após reiniciar o servidor,
  proteção 401/403, conflito de revisão 409, rascunho privado, imagem no rascunho
  e ativação automática após completar o campo. Alterações foram auditadas.
- Navegador com API simulada: e-mail incompleto salvo; última edição antes de
  fechar preservada; recuperação após limpar o armazenamento do navegador;
  título de etapa salvo ao fechar; rótulo documental salvo ao fechar e recuperado
  sem cache local. Nenhum botão Salvar/Publicar foi necessário nesses pop-ups.
- Validação: 665 testes unitários e 17 contratos, TypeScript, segredos,
  acessibilidade estática, finalização, build e smoke HTTP aprovados. Fluxo seguro:
  40 verificações aprovadas. Logs privados em `.portal-data/review56/`.
- Sem migração de banco, envio real de mensagens, push ou publicação no Vercel
  nesta rodada. Configurações locais existentes foram preservadas.

### Ajuste 07 — links dos e-mails apresentados pelo código do TCC (rodada 57)

- E-mails HTML usam botões verdes com o código do trabalho, sem expor o endereço
  longo nas orientações. O destino original, incluindo a aba do processo, é mantido.
- O mesmo tratamento é compartilhado entre o envio e a prévia do Estúdio.
  Botões existentes recebem o código; links externos e imagens são preservados.
- A prévia usa código fictício consistente e links reais de demonstração para a
  aba adequada, substituindo o antigo destino `#`. Pontuação após URLs permanece
  fora do endereço. A alternativa em texto simples mantém links utilizáveis.
- Validação: CI com 669 testes unitários, 17 contratos, TypeScript, segredos,
  acessibilidade estática, finalização, build e smoke HTTP aprovados. Após o
  ajuste de pontuação, nove testes específicos passaram e TypeScript foi repetido.
- Navegador local: prévia sem URLs visíveis, todos os botões de acesso ao processo
  com código TCC-2026-0001 e destinos corretos; nenhum erro de console. A captura
  de tela excedeu o tempo limite; a conferência foi feita pelo conteúdo renderizado.
- Nenhum envio real de e-mail, push ou publicação no Vercel. Log privado em
  `.portal-data/review57/ci.log`.

### Ajuste 08 — orientações por etapa e ambiente local de testes (rodada 58)

- Pedido de reserva limitado a departamento/autores, com orientação em cópia para
  aguardar e próximo objetivo explícito. Indisponibilidade e alternativa também
  orientadas. Convite, avaliação/ata, entrega final e autorização têm instruções
  próprias, evitando antecipar ações de outros papéis. Textos antigos conhecidos
  migrados sem substituir os parágrafos personalizados.
- Preparados 400 registros para volume e 12 cenários funcionais adicionais. Os
  13 exemplos anteriores e configurações foram preservados; backups privados.
  Cada cenário QA58 tem autor próprio, dois examinadores e opção na simulação.
  Um registro visual descartável foi excluído pelo teste de interface: total 411.
- Uploads demonstrativos locais guardam os bytes PDF e metadados por processo,
  tipo e SHA-256. Mesmas permissões e validações HTTP. Produção/Vercel recusam o
  adaptador. Nenhum token Google nem envelope Asten é necessário para os PDFs
  fictícios. Assinaturas arquivadas nos exemplos são somente estados simulados.
- Edição de título deixou de revalidar participantes, autoria e conflitos de
  agenda que não foram alterados. Alterações nesses campos mantêm as validações.
- Corrigidos autenticação da prévia e download privado: carregamento com sessão
  e identificação local; credenciais não enviadas a outra origem. Convite
  efetivamente renderizado em canvas e baixado pela interface.
- Removida consulta de autenticidade pública quando recurso está desativado.
  Modo local deixa de tentar staging remoto para PDFs pequenos e informa que o
  armazenamento é neste computador. O catálogo inicial de modelos não dispara
  autosave antes de estabelecer a base carregada.
- Conferências reais no navegador: título salvo pelo aluno e recuperado após
  recarregar; auditoria com usuário/horário/antes/depois; histórico PDF baixado;
  reanexo e download PDF; convite exibido/baixado; exclusão administrativa de
  fixture; e-mail sem instruções para banca na reserva, sem duplicação e sem URL
  longa. Auditoria da exclusão e preservação das configurações lidas no disco.
- Validação automatizada: 675 testes unitários, 17 contratos, scanner de segredos,
  TypeScript, acessibilidade estática, finalização, build e smoke HTTP aprovados.
  Fluxo seguro: 40 verificações aprovadas. Ajuste posterior de hidratação do
  catálogo também passou por TypeScript, build e regressões de autosave.
- Roteiro em `docs/ROTEIRO_TESTES_LOCAIS_2026-10-23.md`; evidências privadas em
  `.portal-data/review58/`. Sem push, Vercel, envio real de e-mail, assinatura real
  ou substituição das configurações operacionais por credenciais fictícias.
- Fechamento visual: versão local compilada, origem isolada corrigida e catálogo
  hidratado antes do autosave. Resultado `CAPTURAS_GERADAS`: 70 capturas, zero
  erros registrados e zero overflow. Capturas em
  `.portal-data/review58/visual-validated/`. A suíte de quatro regressões de
  autosave passou após o ajuste. A primeira execução com HMR e a execução com
  origem incorreta foram mantidas como evidência das falhas corrigidas.

### Ajuste 09 — condensação da área pública e ordem do tutorial (rodada 59)

- Replicar Portal agora tem cinco caixas: GitHub; Guia para a IA; Modelos;
  Supabase, Vercel e Google Workspace; Asten e Gov.br. Três links de acesso/
  download preservados. Detalhes técnicos continuam no guia para a IA existente.
- Os dois quadros de métodos em Fluxo do TCC usam cinza-claro, token de painel.
- Removida a introdução de Veja onde clicar. Imagens e suas dimensões preservadas.
  Ordem explícita por perfil: acesso primeiro para alunos, orientador e presidência;
  presidência segue acesso, fila, assinatura e download. Visitante continua com
  consultas públicas sem exigir login. Trocar perfil seleciona sua primeira aba;
  setas, Home/End e relações acessíveis entre aba e painel preservadas.
- Verificado em navegador: cinco caixas e três links corretos; nenhuma rolagem
  horizontal em 390, 1024 e 1440 px; caixas de mesma altura em desktop; quadros
  Asten e Gov.br em rgb(233,237,239); ordem dos quatro perfis e troca por teclado;
  nenhum erro de console. TypeScript, build, 14 testes específicos e diff check
  aprovados. Contrato visual atualizado para cinco caixas.
- Sem push, publicação no Vercel ou alterações nos dados de demonstração. Logs
  privados em `.portal-data/review59/`.

### Ajuste 10 — imagem de acesso no tutorial (rodada 60)

- Imagem demonstrativa de Acesso ao Portal em Veja onde clicar reduzida a metade
  da largura anterior, com proporção preservada. As demais imagens e o formulário
  real de login mantêm suas dimensões. Link de imagem em tamanho maior preservado.
- TypeScript e diff check aprovados. Sem publicação no Vercel.

### Publicação final — rodada 61, 23/10/2026

- Revisão dos botões, acesso público, tutorial por perfil, imagem de acesso em
  metade da coluna e cinco caixas de replicação. Atualizados três contratos que
  ainda exigiam os rótulos e dimensões anteriores solicitados pelo usuário.
- Validação: 675 testes unitários, 17 contratos, scanner de segredos, TypeScript,
  acessibilidade estática, finalização, build e smoke HTTP aprovados. Fluxo seguro:
  40 verificações. Galeria: 70 capturas, zero erros registrados e zero overflow.
- Cópia isolada de 570 arquivos, sem `.env.local` nem dados demonstrativos.
  Manifesto privado `.portal-data/review61/source-manifest.json`; SHA-256:
  20e2380ff60943d3f0e4ea211d3c9222cdae86cc618fa14f52a2f5c1cfa51306.
  Fonte selada no commit local 8f6b515d6b6b062c12659cf40b3e03c844df8160.
- Vercel: equipe TCC - Enfermagem, projeto portal-tcc-enfermagem-ufes, implantação
  dpl_DjnXEtuJGKhEbEooAZyKQRriDRG1, READY. Criada inicialmente sem associar domínio;
  promovida após a API candidata responder 200 com o commit esperado.
- Endereço fixo https://portal-tcc-enfermagem-ufes.vercel.app/ confirmado por
  navegador: API 200 e commit 8f6b515; cinco caixas; tutorial ordenado; imagem
  carregada e reduzida; assinatura com fundo cinza-claro; login abre e fecha.
  Visitante sem autenticação e sem papéis. Simulador local ausente.
- Nenhum OTP/e-mail real ou assinatura foi disparado; nenhuma base local foi
  enviada à produção; configurações e dados remotos não foram substituídos.
  Publicação direta na Vercel; sem push/merge de GitHub nesta rodada.

## Rodada 62 — tratamento e titulação, somente local

- Referência Aluno/Aluna por autor; Professor/Professora e titulação por docente,
  antes do nome. Prévia no cadastro, edição na ficha, persistência e auditoria.
- Concordância e nomes completos na geração dos quatro documentos, com
  compatibilidade para fórmulas antigas e sem deduzir gênero de nomes legados.
- Ata: encerramento uma hora após o agendamento; retirada de “por quem de direito”;
  resultado e parecer em negrito, sem sublinhado.
- Modelos originais e documentos já emitidos preservados. Detalhes e marcadores
  em `docs/REFERENCIAS_PESSOAIS_DOCUMENTOS.md`.
- Sem push, deploy, alteração remota de modelos ou envio de comunicação real.
- Verificação final: `test:ci` aprovado (683 testes unitários, incluindo os oito
  testes específicos novos, 17 contratos, acessibilidade estática, finalização,
  build e smoke HTTP); `test:secure-flow` 40/40; TypeScript e `git diff --check`
  aprovados. Navegador confirmou escolhas obrigatórias e condicionais no cadastro,
  prévia de referência e persistência da ficha após recarregar. A exportação real
  pelo Google Drive e o aspecto visual do PDF oficial não foram homologados nesta
  rodada. Aviso de chunks grandes do build permanece.
- Produção consultada somente para leitura: saudável no commit `8f6b515` da
  rodada 61. As mudanças desta rodada 62 permanecem locais.

## Rodada 63 — concordância do termo e ordem dos autores, somente local

- Termo com Eu/Nós, aluno/aluna/alunos/alunas, matriculado/matriculada e flexão
  da autorização. A oração conjunta de autoria e orientação usa autorizamos,
  inclusive com um só aluno. Fórmula antiga com título + função + nome coberta.
- Cinco variantes de autoria no mesmo modelo; novos marcadores documentados em
  `docs/REFERENCIAS_PESSOAIS_DOCUMENTOS.md`. Quatro slots externos preservados.
- Ordem dos nomes escolhida no cadastro, prévia e edição na ficha. Permissões,
  vínculos de identidade e destinatários de assinatura preservados. Persistência,
  auditoria e bloqueio após emissão aplicados à nova escolha.
- `test:ci`: 685 unitários, 17 contratos, acessibilidade estática, finalização,
  build e smoke HTTP aprovados. Fluxo seguro 40/40; navegador validou a pergunta,
  prévia, salvamento e recuperação da ordem. Sem publicação, envio externo ou
  alteração dos originais no Drive. PDF exportado pelo Google ainda não conferido.

## Rodada 64 — variáveis documentais compartilhadas, somente local

- Nome docente padrão por extenso: Professora Doutora Maria Silva. Variantes
  explícitas simples e abreviada e função concordante por docente disponíveis.
- Projeção única compartilhada por prévias, fluxo e os quatro documentos.
  Declaração resolve a função de cada examinador; títulos genéricos não duplicam
  o nome completo. Formatos abreviados e simples explícitos são preservados.
- Cadastro mantém coleta única e acrescenta conferência final de título, autoria
  ordenada e nomes docentes. Arquivos existentes fornecem nome e versão; trabalho
  fornece código e variantes do título, sem novos uploads ou perguntas repetidas.
- 688 unitários, 17 contratos, 40 verificações seguras, TypeScript, build e smoke
  HTTP aprovados; navegador conferiu a apresentação por extenso e o resumo final.
  Sem deploy, alteração remota dos modelos ou envio de e-mails/assinaturas.

## Rodada 65 — solicitação de declaração Asten, somente local

- Leitura de logs e estado de produção identificou declaração cancelada com erro
  histórico de acesso não autorizado e novas requisições sem novo job persistido.
  A resposta exata da preparação antiga não está disponível no histórico.
- Conferência atual inclui integração, fila de retorno, pasta Asten e Google.
  Botão não depende de estado antigo da conexão na página. Mostra destinatário da
  presidência, bloqueio concreto e ação “Gerar e enviar à Asten”.
- Falhas antes da criação do job são auditadas. Destinatário antigo é bloqueado
  antes de qualquer reenvio. Sem reenvio automático de envelopes incertos.
- CI aprovado: 691 unitários, 17 contratos, TypeScript, build e smoke HTTP.
  Diagnóstico em `docs/DIAGNOSTICO_DECLARACAO_ASTEN_2026-10-23.md`.
- Sem deploy, alteração de credenciais ou de estado de produção, nem envio real.
  A criação de novo envelope real continua sem confirmação.

## Rodada 66 — Gov.br com download e devolução pelo Portal (local)

- Botão inicial gera e baixa o PDF pela rota autenticada do Portal. O job fica
  preservado se o download falhar, permitindo baixar novamente sem nova geração.
- Tela apresenta baixar, abrir assinador Gov.br e devolver PDF assinado. Drive
  permanece armazenamento interno, sem exigir acesso do usuário.
- Fingerprint continua exigindo igualdade do hash canônico de todos os arquivos
  do DOCX; diferenças apenas na revisão/data do Drive deixam de bloquear conteúdo
  idêntico. Conteúdo alterado continua bloqueado. A mensagem do modal orienta a
  revisão nas Configurações, sem mandar o signatário ao Drive.
- Teste HTTP confirma PDF como attachment, bytes originais, ausência de redirect,
  permissões, rejeição de PDF sem assinatura/conteúdo alterado, revisão manual por
  hash e arquivo exato após reinício. Teste de fingerprint confirma os dois casos.
- Testes usam arquivos fictícios e modo local. Não comprovam o hash atual dos
  modelos de produção, fidelidade de exportação Google ou assinatura real Gov.br.
- Sem publicação, mudança remota ou envio de documentos reais.
- Verificação concluída: CI com 691 testes unitários e 17 contratos aprovados,
  TypeScript, acessibilidade estática, finalização, build e smoke HTTP; fluxo
  seguro 40/40; `git diff --check` sem erros. Saúde local responde `ok` em
  localhost:3000. Inspeção visual interativa não refeita nesta rodada.

## Rodada 67 — bloqueio documental compartilhado entre Asten e Gov.br (local)

- Geração oficial usa erros compartilhados para modelo ausente, sem hash publicado
  ou com conteúdo divergente. A rota de assinatura retorna código estruturado da
  causa. Asten e Gov.br recebem a mesma explicação, inclusive em Detalhes do TCC.
- Removido tratamento textual exclusivo do modal Gov.br. Mensagem não atribui
  alteração diretamente ao Drive sem prova; indica a ação nas Configurações e
  esclarece que a geração parou antes do envio à Asten/download Gov.br.
- Orientações revisadas no resumo público de assinaturas, Como usar e guia
  ilustrado: geração antes do envio Asten, convite após confirmação, download e
  devolução Gov.br pelo Portal, conferência VALIDAR/ITI e armazenamento interno.
- Sem mudança estrutural nas caixas do processo e sem texto adicional no editor
  administrativo de fluxos. Sem publicação, envio real ou alteração de modelos.
- O conteúdo atual dos modelos de produção ainda precisa ser comparado; a
  correção local não comprova que o arquivo ativo corresponde ao hash publicado.
- Verificação: CI aprovado (691 unitários, 17 contratos, build e smoke HTTP),
  fluxo seguro 40/40 e diff sem erros. Alterações de texto posteriores ao build
  conferidas por TypeScript. Sem inspeção visual interativa nesta rodada e sem
  homologação de geração em Google Drive/Asten reais.

## Rodada 68 — reserva de defesa com duração fixa de 90 minutos (local)

- Cadastro e alteração de horário calculam término pelo início + 90 minutos,
  inclusive quando o cliente informa outro término ou há configuração antiga.
- Agenda, ICS, conflitos e sincronização Google Calendar usam a mesma regra.
- Formulário de edição envia o término calculado pela função compartilhada.
- Exemplo: início 08h10, término 09h40. Teste cobre também virada de dia.
- Não altera a regra de data/hora usada nos documentos, nem escreve em agenda
  remota nesta rodada. Eventos Google existentes exigem sincronização posterior.
- Verificação: 692 testes unitários e 17 contratos aprovados, TypeScript e build.
  Teste HTTP específico confirma 08h10–09h40 mesmo com configuração antiga de
  120 minutos e cliente enviando outro término; histórico registra o valor final.

## Rodada 69 — reservas por sala e local visível na agenda (local)

- Checagem usa sobreposição de intervalos de 90 minutos e local normalizado.
  Salas diferentes admitem defesas simultâneas; mesma sala bloqueia sobreposição,
  inclusive com a opção de conflitos de participantes desabilitada. Mantido o
  mecanismo administrativo existente de exceção justificada e auditada.
- Confirmação do aluno compara o local efetivamente autorizado, não a alternativa
  aceita no pedido. A alternativa não ocupa uma segunda sala automaticamente.
- E-mail ao departamento informa preferência, alternativa e duração/início/fim.
  Quando faltar alternativa em registro antigo, a orientação usa outro local da
  configuração da instalação, sem alterar o registro do processo.
- Calendário mostra local abaixo do horário/título/autores, inclusive eventos
  Google. Local ainda pendente aparece como “a confirmar”. Tooltip inclui sala.
- Testes cobrem salas diferentes simultâneas, sobreposição na mesma sala,
  limite exato 09h40, participantes, e-mail e resumo confirmado/pendente.
- Sem publicação nem reserva, envio de e-mail ou sincronização Google reais.
- Verificação final: CI, TypeScript, build e smoke HTTP aprovados; testes
  específicos 16/16 e fluxo seguro 40/40. Diff sem erros. Sem inspeção visual
  interativa ou homologação de reservas/e-mails em serviços externos.

## Rodada 70 — paridade do espelho do formulário e publicação

- Corrigido espelho/editor administrativo do cadastro: agora projeta as mesmas
  perguntas canônicas do formulário real, mesmo com configuração salva antiga.
  Tratamento e titulação ficam na seção do nome correspondente. Ordem dos autores
  e referência Aluno/Aluna também entram no cadastro e na prévia.
- Dados demonstrativos explícitos no espelho para autoria, tratamento e titulação.
- Navegador local confirmou campos visíveis no espelho. Captura privada em
  `.portal-data/review70/registration-mirror.png`.
- Conferidos testes de linguagem dos quatro documentos, variáveis, estilos em
  negrito sem sublinhado e prévia administrativa independente da publicação.
- Corrigido fallback do local alternativo do e-mail para usar a configuração da
  instalação em vez do catálogo padrão.
- Publicação usa snapshot isolado; não leva dados locais nem credenciais.
  Testes com provedores simulados não comprovam assinatura real Asten/Gov.br.
- Publicado em produção no Vercel: commit c3b88fc2389c7987eceea1b42111203444607445,
  deployment dpl_5MzsfEEi6W2qa3wsGp2BBK8q33Hb, estado READY e domínio público
  confirmado na API Vercel. CI: 696 unitários, 17 contratos; seguro 40/40;
  visual compilado: 70 capturas, zero erros e zero overflow. Sem push GitHub.
- Modelos oficiais do Drive não foram substituídos; os ajustes de linguagem são
  aplicados pelo motor ao preencher cópias. Assinatura real não homologada nesta
  rodada; a comparação do conteúdo publicado continua protegendo a geração.

## Rodada 71 — ajustes da ata conforme conferência do usuário (somente local)

- Linha final de cidade/data sem horário; mantém horário na frase de encerramento.
- Nomes docentes abreviados em todas as quatro saídas documentais, tanto no corpo
  quanto nos blocos de assinatura. Dados de tratamento e titulação continuam
  separados no cadastro; não se deduz referência pelo nome.
- Integrantes da banca sem 2º/3º; removida vírgula antes dos dois-pontos.
- Cópia temporária remove parágrafo opcional do segundo autor ausente e um
  parágrafo vazio adjacente, preservando o bloco quando há segundo autor e sem
  remover conteúdo institucional ou estrutura de tabelas.
- Prévia de identificação do formulário usa nomes docentes abreviados.
- Sem publicação no Vercel e sem alteração do arquivo oficial no Drive.
- Verificação: 698 testes unitários e 17 contratos aprovados; TypeScript, build e
  smoke HTTP aprovados. Sem inspeção do PDF oficial real nesta rodada; os testes
  cobrem adaptação textual e requisições da cópia temporária no Google.

## Rodada 72 — tom da carta-convite e função da orientação (somente local)

- Carta-convite dirigida “Aos docentes convidados”; texto convida a participar da
  banca de defesa, sem tratar a banca como comissão já constituída.
- “Membros convidados para a banca” substitui “Demais integrantes da comissão”.
- Agradecimento passa a reconhecer atenção ao convite e expectativa de contribuição.
- Fora da ATA, orientação não acumula presidência da sessão. Mantida a função
  institucional da Presidência da Comissão nos documentos que ela assina.
- Abreviações docentes da rodada 71 também se aplicam a esses trechos.
- Testes cobrem o texto da imagem, idempotência e distinção entre presidência da
  sessão e Presidência da Comissão. Sem publicação ou alteração do modelo no Drive.
- Verificação concluída: 700 unitários, 17 contratos, TypeScript, build e smoke
  HTTP aprovados; diff sem erros. PDF oficial real não renderizado nesta rodada.

## Rodada 73 — termo com escopo expresso de publicação (somente local)

- Termo substitui “Monografia ou Resumo Expandido” por AUTORIZAMOS e duas linhas:
  monografia completa e resumo expandido do artigo produzido. Cada linha mostra
  caixa marcada/desmarcada e publicação autorizada/não autorizada.
- Marcas são derivadas exclusivamente dos booleanos persistidos no Repositório.
  Arquivo anexado não equivale a autorização; variáveis extras não podem forjar
  as marcas. Não altera as escolhas salvas nem a regra que dispensa termo quando
  nenhuma publicação foi solicitada.
- Destino passa a repositório público, preservando a identificação institucional
  do modelo. A autorização fica limitada aos itens assinalados.
- Cópia temporária compacta parágrafos vazios e espaçamento dos nomes/funções na
  área de assinaturas do termo, preservando todos os signatários existentes.
- Testes cobrem só monografia, só resumo, ambos, nenhum e compactação limitada.
- Sem publicação no Vercel, envio real ou alteração do modelo oficial no Drive.
- CI aprovado: TypeScript, testes unitários/contratos, build e smoke HTTP.
  Teste adicional confirma marcas legíveis no PDF local de demonstração; usa
  [X]/[ ] quando a fonte básica não suporta as caixas Unicode.
- Não foi renderizado o modelo oficial real do Drive nesta rodada; a geometria
  final ainda deve ser conferida na amostra gerada com o modelo da instalação.

## Rodada 74 — uniformização dos papéis e nome escolhido (somente local)

- Nova decisão do usuário substitui as rodadas 71/72: orientação acumula a
  presidência da sessão nos quatro documentos. Demais membros são Examinador ou
  Examinadora conforme tratamento escolhido, sem ordinais.
- Nomes docentes continuam abreviados. Presidência institucional da Comissão
  permanece distinta da presidência da sessão atribuída à orientação.
- Declaração remove um parágrafo vazio antes da data e compacta o espaçamento da
  linha, sem alterar a data nem a identificação institucional.
- Formulário orienta expressamente sobre o nome desejado nos documentos, inclusive
  nome social, e mantém a grafia/capitalização digitada. Tratamento e titulação
  continuam sendo escolhas explícitas e obrigatórias no cadastro novo.
- Testes cobrem grafia McDonald/d’Ávila, referência escolhida, papéis nos quatro
  documentos, ajuda do formulário e alteração limitada do espaçamento da data.
- Sem publicação no Vercel, alterações remotas ou PDF oficial real renderizado.
- Validação final: 705 unitários e 17 contratos aprovados, TypeScript, build,
  smoke HTTP e diff sem erros. Sem inspeção do PDF oficial real nesta rodada.

## Rodada 75 — frase guiada de autoria no cadastro (somente local)

- Cadastro acrescenta “Estava presente [o aluno/a aluna] Nome” ou “Estavam
  presentes [os alunos/as alunas] Nomes”, com a referência selecionada no trecho.
- Campo substitui seleções individuais de referência dos autores no formulário
  novo. Número de autores determina as únicas opções válidas. Mudança do número
  limpa a escolha anterior. Ordem oferece os nomes preenchidos, não nomes fixos.
- Escolha é persistida nas respostas e derivada para a representação canônica dos
  autores; concordância dos quatro documentos usa esses dados. API valida escolha
  obrigatória e singular/plural em cadastros novos (v3); compatibilidade v2 mantida.
- Tratamento, titulação e nome docente ficam na mesma linha em telas largas;
  seletores preservam opções formais e prévia abreviada. No celular se empilham.
- Navegador confirmou opções condicionais, limpeza de escolha, ordem invertida e
  prefixos ao lado do nome, sem enviar cadastro. Capturas locais em review75.
- Sem publicação no Vercel, envio de e-mails, assinatura real ou alteração do Drive.
- Validação: CI com 707 unitários e 17 contratos; TypeScript, build e smoke HTTP
  aprovados. Fluxo seguro 40/40. Navegador confirmou desktop e celular sem
  overflow na tela docente. Última limpeza de textos duplicados validada por
  TypeScript e nova execução do roteiro de navegador.


## Rodada 76 — Gov.br sem repetição de código (somente local)

- Removida a confirmação adicional por código na preparação, devolução e
  aprovação da conferência Gov.br. Login normal e validade da sessão preservados.
- Removidos formulário de OTP e bloqueios de botões correspondentes no modal.
- Devolução final da ata/termo é do orientador; declaração é da Presidência.
  Administradores mantêm acesso operacional. Regra aplicada também na API e
  na autorização de envio por armazenamento intermediário.
- Conferência manual no VALIDAR/ITI, vínculo com o PDF original, hash, revisão,
  pré-requisitos e autorização do processo continuam obrigatórios.
- Atualização do detalhe após alteração do job agora é silenciosa para preservar
  o modal, o download e o campo de devolução.
- Teste HTTP usa sessão EMAIL_OTP assinada, com autenticação de uma hora atrás:
  preparação, download, devolução e aprovação funcionam sem confirmação recente.
  A mesma sessão recebe 428 em operação administrativa sensível não relacionada.
- Navegador confirmou download e devolução sem OTP, desktop e celular sem
  overflow. Endpoints de geração/download simulados nessa verificação visual;
  endpoints reais locais exercitados pelo teste HTTP isolado, sem serviços reais.
- Contrato estático antigo do título do cadastro atualizado para a apresentação
  vigente “Autoria nos documentos”; posição dentro do cartão continua validada.
- Nenhuma publicação, e-mail, assinatura real ou alteração do Drive nesta rodada.
- Validação final: 708 unitários, 17 contratos e 40 verificações de fluxo seguro
  aprovados; TypeScript, acessibilidade estática, finalização, build, smoke HTTP
  e diff sem erros. Capturas e resultados locais em `.portal-data/review76/`.

## Rodada 77 — recuperação de modelo divergente no pop-up Gov.br (local)

- Leitura real e restrita do cadastro no Supabase e do modelo no Google Drive
  confirmou divergência da declaração. Hash publicado em 12/09 difere da
  exportação atual; duas exportações atuais têm todas as entradas idênticas.
  Isso confirma divergência estável, sem atribuir autoria ou causa da alteração.
- Não foram alterados dados, modelos nem credenciais de produção. A primeira
  tentativa de diagnóstico por arquivo de ambiente não encontrou configuração
  utilizável; a leitura foi concluída pelos conectores Supabase e Drive.
- Modal Gov.br oferece recuperação administrativa: visualizar a amostra atual,
  publicar exatamente arquivo/versão/hash revisados e gerar/baixar o PDF real
  pelo fluxo normal. Conferência da amostra é necessária só para divergência.
- Prévia usa o componente PDF existente, compatível com a política CSP; o botão
  de publicação só é habilitado após carregar o PDF. Não há iframe dependente
  do visualizador nativo do navegador.
- Nova rota administrativa recusa troca de arquivo, versão concorrente e hash
  diferente após a prévia. Histórico e auditoria da publicação preservados.
  Anônimos e alunos recusados; sessão normal é suficiente, sem novo OTP.
- CI: 710 unitários, 17 contratos, TypeScript, acessibilidade, finalização, build
  e smoke HTTP aprovados. Fluxo seguro 40/40. Após trocar iframe pelo componente
  de PDF, nova verificação do navegador, TypeScript e build.
- Navegador exercitou erro → amostra → publicação → download → devolução, sem
  OTP, em desktop/celular. Geração e publicação simuladas nessa verificação UI;
  nenhuma assinatura real, geração oficial Google ou publicação remota efetuada.
- Evidências locais em `.portal-data/review77/`. Sem deploy no Vercel.


## Rodada 78 — publicação e verificação real da declaração

- Publicação final no endereço oficial confirmada pelo Vercel: commit
  `3443bf78f0b8b6e1763f893213a210b1e15bdd40`, deployment
  `dpl_4ENSBV4NVHSiApfJmJwyEma7o6iX`. Navegador confirmou fingerprint 3443bf7.
- Release isolada passou 710 unitários, 17 contratos, TypeScript, acessibilidade,
  finalização, build e smoke HTTP. Fluxo seguro 40/40. Segredos: 593 arquivos
  versionados verificados. Checkout principal e dados/credenciais locais preservados.
- No portal de produção, amostra real da declaração revisada e modelo publicado
  como versão 2, preservando histórico. Hash atual passou a coincidir com a versão
  ativa; a geração oficial não usa a amostra nem contorna a integridade.
- PDF real do TCC-2026-0001 gerado no Google e baixado pelo Portal, sem OTP extra:
  uma página, 101998 bytes, nomes/título do TCC, sem marca de amostra ou marcadores
  pendentes. SHA-256 95919d3cb3d708c61260f1c56f5982bc002581a07e948655826ef7cfc0662e07
  coincide com o job persistido sig_dccfb963d274ac729291eb1c.
- Signatária conferida: Presidência cadastrada. Job permanece READY_FOR_REVIEW,
  assinatura WAITING. Campo de devolução e PDF disponíveis também após recarregar.
- Teste real de devolução identificou constraint antiga que recusava o propósito
  GOV_BR_SIGNED_PDF. Migração incremental aplicada no Supabase com esse propósito,
  mantendo MIME, limite, cotas, RLS forçado e proibição de INSERT para anon/authenticated.
- Nova tentativa real chegou à análise do PDF e recusou corretamente o arquivo
  sem assinatura digital incorporada. Transporte de devolução verificado em produção.
- Não houve e-mail, envelope Asten, assinatura em nome de pessoa, aprovação de
  conferência ou conclusão do processo. Aceitação de um PDF realmente assinado
  no Gov.br e conferência manual no ITI permanecem para o teste do titular.
- Evidências e PDF baixado preservados em .portal-data/review78/. GitHub não foi
  atualizado; a publicação foi feita diretamente pela CLI no projeto Vercel existente.

## Rodada 79 — Asten e Gov.br independentes, seleção e botões

- Removida exclusividade entre os provedores na criação, preflight, despacho e
  retomada: Gov.br não cancela Asten, e Asten não bloqueia Gov.br. Repetição em
  cada serviço mantém a mesma solicitação, sem duplicar envelopes. Envios Asten
  incertos continuam exigindo reconciliação na própria Asten.
- Criações simultâneas dos dois provedores são serializadas por documento para
  preservar números de versão e códigos de verificação distintos.
- Documento já arquivado da mesma revisão continua disponível e satisfaz as
  etapas acadêmicas mesmo que o segundo provedor ainda esteja pendente.
- Área da Presidência aceita seleção; modal Asten tem caixas por declaração,
  contagem da seleção e envio somente dos itens marcados e elegíveis. Estados
  realmente indisponíveis mostram motivo e botão desabilitado em cinza.
- Detalhes exibem somente Asten e Gov.br, ambos verde-musgo. Gov.br recupera o
  andamento existente no mesmo botão; botão Continuar Gov.br removido. Ações
  também permanecem disponíveis nas declarações já concluídas.
- Validação local: 712 unitários, 17 contratos, 40 verificações seguras, TypeScript,
  acessibilidade, build, smoke HTTP e diff aprovados. HTTP real isolado exercita
  provedores juntos, concorrência, idempotência e preservação do PDF arquivado.
- Navegador confirmou seleção na tabela e no modal, botão desabilitado sem itens,
  dois botões com cor musgo e tela pequena sem overflow. Preflight visual simulado;
  nenhuma notificação externa enviada nessa validação.

- Publicação 79 confirmada no domínio oficial: commit
  `2322196b3b0481b6124212e5356f71c32d63ada0`, deployment
  `dpl_AZWtAfTPitZXNPNhMAyR84o6WJHw`; navegador autenticado confirmou build 2322196.
- Com autorização explícita do usuário, declaração real TCC-2026-0001 selecionada
  e encaminhada à Presidência em colenfufes@gmail.com. Envelope Asten 92942,
  job sig_79c00ede8d90934e3167c4fb, documento v3; criação CONFIRMED e despacho SENT
  em 24/10/2026 às 14:31:16. Sem erro. Consulta posterior getDadosEnvelope pela
  ação Reconciliar confirmou SENT às 14:32:19; estado persistido no Supabase.
- Depois de recarregar, Registros de Assinatura exibiu o envelope Asten 92942 e
  a solicitação Gov.br v2 READY_FOR_REVIEW simultaneamente. Gov.br preservado,
  sem cancelamento e sem nova confirmação de código durante o envio Asten.
- Signatária permanece WAITING: criação, encaminhamento e consulta externa
  comprovados; assinatura pessoal e retorno do PDF deste novo envelope ainda
  dependem da titular. Nenhuma assinatura foi efetuada em nome da pessoa.
- Evidências em .portal-data/review79/asten-production.png e
  asten-govbr-registros-producao.png; resultado estruturado em publication-result.json.

## Rodada 80 — aviso de documentos finais com um único acesso

- Refatorado o aviso email-conclusao: saudação individual, título e autoria do
  trabalho, um único botão com o protocolo e instrução curta de acesso. Removida
  a composição duplicada de modelo, orientações globais e múltiplos botões.
- Banca recebe orientação de consulta; somente autores recebem a nota sobre
  opções de publicação. Modelo de entrega e prévia do Estúdio compartilham o
  mesmo renderizador. Outros modelos personalizados permanecem no fluxo anterior.
- HTML de e-mail com tabelas de apresentação e estilos inline, largura máxima
  de 600px; versão texto com um único endereço utilizável. Dados escapados e
  endereço do Portal limitado a HTTP/HTTPS.
- TypeScript e 16 testes direcionados aprovados; navegador conferiu a prévia
  gerada pelo renderizador real. Captura em .portal-data/review80/email-documentos-refeito.png.
- Alteração local para avaliação visual; sem novo envio de e-mail ou publicação.

- Preparação de publicação: auditoria atualizou body-parser para 1.20.9 e Zod
  para 4.6.6 por overrides compatíveis com as séries instaladas. Lockfile
  atualizado; instalação limpa e auditoria npm com zero vulnerabilidades.

## Rodada 81 — separação entre banca e autoria na ata (local)

- Acrescentado espaçamento de 24 pt antes do primeiro nome de aluno após o bloco
  do último examinador. A regra reconhece o nome em parágrafo próprio, mantém a
  ordem de autoria e aplica-se a um ou dois alunos, sem criar espaço de autor ausente.
- Ajuste feito por estilo de parágrafo somente na cópia temporária da ata, depois
  da mescla. Sem alterar texto, cabeçalho, tabela, assinatura da banca ou modelo fonte.
- TypeScript e 21 testes direcionados aprovados, incluindo ambos os tamanhos de
  autoria e preservação do conteúdo. Renderização real no Google não executada.
- Pedido expresso: manter local enquanto o usuário envia os demais ajustes.
  Nenhuma publicação no Vercel nesta rodada.

## Rodada 82 — variáveis em negrito nos quatro documentos (local)

- O renderizador marca em negrito todos os marcadores que serão preenchidos,
  independentemente da antiga seleção de regras bold no Estúdio. Suporta as cinco
  sintaxes de marcador, trechos divididos em runs, tabelas, abas e cabeçalhos.
- O estilo é aplicado na cópia temporária antes da mescla: muda somente bold e
  underline, preservando fonte, alinhamento, texto fixo e modelo original.
- Após a concordância gramatical, reforça o negrito dos nomes completos abreviados
  dos docentes e dos autores, além de resultado e parecer, evitando que o prefixo
  inserido posteriormente fique com formatação diferente do nome.
- 26 testes direcionados e TypeScript aprovados. A suíte cobre Carta-Convite,
  Ata, Termo e Declaração com API Google simulada; não houve renderização real
  no Google nem publicação no Vercel. Espaçamento local da rodada 81 preservado.

## Rodada 83 — disciplina e intervalo das opções do termo (local)

- Corrigida na cópia gerada do termo a referência legada ENF05041 Orientação a
  Monografia II para ENF16130 Trabalho de Conclusão de Curso II, conforme matriz
  versão 2020 disponibilizada no site do curso. Fonte em REFERENCIAS_DO_CURSO.md.
- Uma linha de separação após AUTORIZAMOS: antecede as duas opções de publicação.
  Se o modelo já contiver as opções em parágrafos separados e sem linha vazia,
  aplica 12 pt antes da primeira opção; não duplica o intervalo já existente.
- Mantidas as escolhas independentes e as marcações de publicação. Nenhuma
  edição do modelo original nem modificação de disciplinas de outras instalações.
- 31 testes direcionados e TypeScript aprovados; testes de Google simulados.
  Sem exportação real no Google nem publicação no Vercel nesta rodada.

## Rodada 84 — conferência dos nomes completos em negrito na declaração (local)

- Conferida a regra já implementada na rodada 82: negrito abrange prefixo e nome
  inteiro, após a abreviação. Teste do renderizador ampliado com Beatriz Oliveira
  Santos e Rafael Almeida Lima, cobrindo os dois examinadores nos quatro documentos.
- 26 testes direcionados e TypeScript aprovados, com API Google simulada.
  Sem nova alteração de produção; o site ainda exibe o build publicado anterior.

## Rodada 85 — documento assinado permite apenas consulta e download (local)

- Regra atualizada conforme pedido: provedores permanecem independentes somente
  enquanto a revisão está pendente. SIGNED, DRIVE_SYNC_PENDING e ARCHIVED fecham
  novas solicitações de assinatura da mesma revisão, por Asten e Gov.br.
- Detalhes ocultam os dois botões de assinatura em documentos assinados. Área do
  Presidente também remove ações/seleção para documentos concluídos. Ver e Baixar
  PDF continuam disponíveis quando o arquivo está arquivado.
- Servidor bloqueia criação e reenvio; preflight do lote recusa declaração assinada.
  Históricos de outros provedores e PDFs existentes não são cancelados/apagados.
- 37 testes direcionados e TypeScript aprovados. HTTP isolado confirma 409 para
  nova solicitação Asten ou Gov.br após arquivo assinado, mantendo o download.
- Navegador local com respostas isoladas confirmou ata assinada sem Asten/Gov.br,
  com Ver/Baixar habilitados; declaração pendente mantém os dois provedores.
  Evidência: .portal-data/review85/completed-document.png. Sem envio externo/deploy.

## Rodada 86 — análise do aviso de integridade em TCC concluído (local)

- Consulta somente leitura ao estado/auditoria de produção confirmou a origem:
  SOLICITACAO_ASSINATURA_FALHOU em 25/10/2026 02:42:14Z, ATA/ASTEN,
  DOCUMENT_MODEL_CONTENT_CHANGED. Foi tentativa de gerar novamente a ata, não
  erro da rota de download. Ata ARCHIVED e declaração Asten v3 ARCHIVED mantêm
  arquivos assinados registrados e lastError vazio.
- A ata é da revisão 4 e o processo passou à revisão 6 durante as etapas finais.
  Servidor agora também bloqueia nova solicitação se o processo está CONCLUIDO,
  evitando que essa diferença histórica permita recriar uma ata já finalizada.
- Aviso da tentativa passa a identificar o documento e permite Fechar aviso;
  limpa ao trocar de TCC/usuário e deixa de ser exibido quando o documento
  correspondente já aparece assinado. Auditoria e integridade não são apagadas.
- A consulta/baixar PDFs arquivados continua usando o arquivo assinado no Drive,
  sem renderizar novamente o modelo. Nenhum hash ou modelo de produção foi alterado.
- 23 testes direcionados e TypeScript aprovados; navegador local com API isolada
  confirmou aviso contextual, fechamento e ações de documento assinado.
  Sem envio externo, nova assinatura ou publicação no Vercel.

## Rodada 87 — ordem dos autores definida pelo cadastro (local)

- Removido o seletor AUTORIA_ORDEM do cadastro, inclusive se ainda existir no
  formulário publicado antigo. Retirado também o controle de ordem nos detalhes.
- Campos Aluno 1 e Aluno 2 informam que essa é a sequência nos documentos.
  Frase demonstrativa, resumo e payload de novos cadastros seguem essa sequência.
- Rascunhos antigos com ordem invertida não invertem novos cadastros; a resposta
  obsoleta é descartada no payload. Preferências históricas de processos já
  existentes continuam preservadas, sem migração ou troca de identidade.
- 28 testes direcionados e TypeScript aprovados. Navegador local confirmou
  cadastro sem seletor e frase Frederico Zacché de Aguiar e Larissa Pandolfi Soares
  na sequência dos campos. Nenhum cadastro foi enviado no teste.
- Evidência em .portal-data/review87/form-order.png. Sem publicação no Vercel.

## Rodada 88 — separar os dois avaliadores no cadastro (local)

- A seção Banca apresenta dois grupos identificados: Primeiro avaliador e
  Segundo avaliador. Cada grupo contém seus seis campos e sua prévia de nome,
  mantendo tratamento/titulação/nome na mesma linha em telas amplas.
- Títulos próprios, espaço e divisória horizontal delimitam os grupos, sem
  misturar e-mails, instituições ou SIAPE. No celular os campos se empilham.
- TypeScript e 16 testes direcionados aprovados. Navegador local confirmou
  seis campos por grupo, prévias corretas, ausência de mistura entre os dados
  e tela de 390px sem overflow. Nenhum cadastro enviado.
- Evidência em .portal-data/review88/examiner-groups.png. Sem deploy no Vercel.

## Rodada 89 — cadastro com a conta institucional do curso no Gmail (local)

- Exceção explícita para tccenfermagemufes@gmail.com na validação do e-mail de
  aluno no cadastro, edição e importação de autorizados. Demais endereços seguem
  os domínios de alunos configurados; aliases +teste e outros Gmail não entram.
- A validação geral de domínios/autenticação não foi ampliada. Login, papéis,
  cadastro próprio e lista de autorizados para não administradores e unicidade
  de TCC por aluno permanecem. Formulário informa o endereço adicional permitido.
- 11 testes direcionados aprovados. Teste HTTP com banco local temporário confirmou
  criação usando a conta como Master e Aluno 1, recusa de outro Gmail, bloqueio sem
  autenticação e recusa de cadastro duplicado. Fluxo externo não homologado no teste.
- Navegador local aceitou o endereço e avançou à próxima etapa. TypeScript aprovado.
  Nenhum TCC de produção criado e nenhuma publicação no Vercel nesta rodada.


## Rodada 90 — revisão consolidada para publicação em 25/10/2026

- Pacote reúne as rodadas 81–89: espaços e negritos dos documentos, disciplina
  ENF16130, bloqueio de nova assinatura em documento/processo concluído, aviso
  contextual, ordem automática dos autores, grupos de avaliadores e e-mail do curso.
- Revisão completa recuperou a orientação de nome social nos dois campos de
  alunos, preservando também a explicação da ordem. Testes antigos de tempo
  foram repetidos sem alterar seus limites e passaram na execução final.
- CI final: 735 testes unitários, 17 contratos, TypeScript, scanner de segredos,
  acessibilidade estática, finalização, build e smoke HTTP aprovados.
  Fluxo seguro 40/40. Auditoria npm com zero vulnerabilidades.
- Publicação realizada por release isolada, sem dados de desenvolvimento,
  credenciais locais ou alterações nos registros acadêmicos de produção.
