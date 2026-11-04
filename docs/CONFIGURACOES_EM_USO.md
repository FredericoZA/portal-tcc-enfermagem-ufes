# Configurações e saídas do Portal

Configurações deve exibir e alterar as mesmas fontes utilizadas no funcionamento do Portal.

- **E-mails:** a prévia chama `processEmailMessage`, utilizado em `sendTrackedPortalEmail`. O editor começa pelo texto efetivo da rotina, convertido em variáveis, e não pelo texto histórico do catálogo. Uma personalização explícita permanece nas migrações. Assunto e corpo personalizados são utilizados no envio, inclusive no aviso de entrega final.
- **Destinatários:** a reserva tem um endereço configurável do departamento. Outros locais são decididos pelo orientador. Botões de decisão pertencem somente à mensagem do responsável; o grupo recebe a cópia informativa. Os avisos coletivos e seus destinatários são reunidos pelo sistema. Campos antigos de CC, CCO, responder para e destinos de botões não eram consumidos por essas rotinas e foram retirados do editor, sem apagar os registros armazenados.
- **Cadastro:** campos e condições usam `registrationQuestions`. A prévia utiliza `ConfigurableRegistration` em modo de demonstração, com identidade fictícia e sem consultas, gravação de rascunho ou criação de processo. Título, introdução, progresso, texto final de envio e mensagem de conclusão são lidos da configuração correspondente.
- **Confirmação da reserva:** a página pública autorizada e a prévia usam `reservationConfirmationView`. Título e descrição são configuráveis. Público, decisões possíveis e dados do pedido permanecem protegidos. Não há um questionário genérico nem uma escolha editável de local nessa etapa.
- **Formulários adicionais:** a prévia usa `DynamicStudioForms` em modo sem envio. O runtime entrega somente a apresentação daquele formulário, e utiliza o texto de envio e a confirmação configurados.
- **Comprovantes:** os dois resultados da reserva são configurados na seção própria. Título e apresentação são aplicados pelo gerador `createReservationReceiptPdf`; a prévia usa esse mesmo gerador, com marca de amostra. Identidade institucional, fatos registrados, decisão e atribuição da resposta não podem ser substituídos por texto configurável.
- **Identidade:** brasão e assinatura institucional seguem o padrão do Portal. O editor não oferece upload de uma imagem que o gerador institucional desconsidera. A imagem complementar dos e-mails continua configurável e passa pela mesma fila das demais gravações.

## Salvamento e concorrência

As gravações de configuração e de imagem compartilham a fila. Alterações independentes de formulários ou e-mails são combinadas por ID e campo; alterações conflitantes no mesmo campo exigem conferência e não são sobrescritas. Falhas de imagem preservam o arquivo no rascunho e apresentam a causa recebida, em vez de atribuir toda falha a outra sessão.

A publicação da configuração continua passando pela validação do pacote. Um pacote incompleto fica como rascunho; a interface informa que o Portal permanece na última versão publicada. Isso é separado da publicação da aplicação no Vercel.

## Verificação

`studioRuntimeParity.test.ts` e `studioRuntimeParityHttp.test.ts` verificam equivalência com o envio, personalização sem congelar dados fictícios, preservação de edições, autorização, persistência após reinício, PDF real e ausência de efeitos operacionais das prévias. Testes locais não comprovam entrega pelo Gmail, resposta do departamento nem assinatura pelo Asten em produção.
