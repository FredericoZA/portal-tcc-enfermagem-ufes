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

## Exibição das planilhas

A engrenagem de cada planilha controla colunas visíveis, ordem, linhas por página,
filtro de período e quebra do texto. Larguras ajustadas arrastando o cabeçalho
seguem a mesma preferência. A identidade visual institucional continua comum.

- **Definir padrão** é exclusivo do Master: salva diretamente o padrão daquela
  planilha no servidor. Não exige publicar o portal novamente.
- A preferência pessoal é vinculada à sessão e à planilha. É recuperada em outro
  navegador após o acesso e prevalece sobre o padrão geral.
- **Restaurar padrão** remove a personalização da conta e reaplica o padrão do
  Master, incluindo quebra de texto, paginação e larguras.
- Preferências pessoais antigas deste navegador são migradas para a conta, sem
  percorrer ou aproveitar as preferências de outros usuários. Uma restauração
  fica registrada para impedir que um cache antigo a desfaça em outro aparelho.
- Salvar a exibição não abre a barra global de processamento nem altera dados
  de TCC, permissões de acesso ou publicação de arquivos.

Rotas próprias validam somente apresentação de tabelas conhecidas. A sessão
identifica o dono da preferência; parâmetros de e-mail não selecionam outra
conta. O padrão do Master é público; preferências pessoais não são incluídas
em `/api/settings`. Backup administrativo e persistência do estado incluem as
preferências. Nenhuma alteração às credenciais ou às regras de assinatura é
necessária.

## Excluir registros de assinatura

Em Registros de Assinatura, o Master usa a lixeira da coluna Ações. A coluna
permanece acessível durante a rolagem horizontal. A exclusão requer confirmação
e retira o registro das listas operacionais, avisos e painel de assinaturas,
inclusive depois de recarregar ou reiniciar o servidor. Uma lista vazia não
recebe mais uma assinatura fictícia de demonstração.

Solicitações Asten pendentes exigem cancelamento confirmado pelo provedor. Se
houver envio em curso, arquivamento pendente ou criação de envelope com resultado
incerto, a exclusão é recusada até a conclusão ou reconciliação. Uma falha na
confirmação não é apresentada como exclusão bem-sucedida.

Excluir o registro de um documento arquivado preserva o PDF original, suas
assinaturas e a comprovação que mantém o fluxo acadêmico concluído. O sistema
mantém um marcador privado de exclusão e o evento de auditoria, para que retornos
atrasados não reativem a solicitação. Isso não equivale a expurgar o envelope já
concluído da conta externa Asten nem a apagar a assinatura dentro de um PDF.
