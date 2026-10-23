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
