# E-mails e confirmação direta da reserva

Alterações preparadas localmente em 26/10/2026. Não publicadas nesta rodada.

## Fluxo

1. O pedido de reserva vai ao departamento, aos autores e à orientação. Cada destinatário recebe uma mensagem individual: a do departamento contém o botão restrito de decisão; as dos autores e orientação contêm o botão de acompanhamento do TCC, sem autorização de confirmação.
2. O formulário mostra título/protocolo, data e intervalo de 90 minutos. O departamento seleciona um dos locais solicitados ou informa indisponibilidade e confirma a conferência antes de enviar.
3. A resposta é persistida e auditada. Gera uma cópia imutável em PDF na fila existente de formulários `CONFIRMACAO_LOCAL`; o arquivamento no Drive tem estado próprio e pode ser retomado pela secretaria.
4. Departamento, autores e orientação recebem o comprovante por e-mail. O departamento consulta seu comprovante pelo link restrito, sem login. Os participantes acessam Dados do processo. Os e-mails mantêm um único botão; não transportam PDFs anexados.
5. A confirmação de disponibilidade dispara o evento existente `LOCATION_CONFIRMED`. A etapa só passa para convite depois de concluída a geração e o envio. Falha de Drive/modelo/Gmail não é apresentada como convite enviado. Indisponibilidade mantém a reserva pendente para correção pelos autores.
6. Alterar data, horário ou local antes do convite reinicia a reserva, preserva o histórico e invalida o link anterior. O formulário não modifica convites já expedidos.

O aviso `Cadastro recebido` é exclusivo dos autores e orientação. O aviso Agendamento confirmado também é exclusivo dos autores e orientação; o departamento recebe o próprio comprovante da resposta registrada. O comprovante dos participantes não é enviado ao departamento: este recebe sua própria versão, com acesso ao comprovante sem login.

## Proteções e compatibilidade

- HMAC com domínio específico e chave de sessão do servidor; validade de 14 dias; vínculo ao processo, revisão e destinatário configurado. Não há dados pessoais no conteúdo legível do token, exceto o e-mail do departamento e o identificador do processo.
- GET não confirma nem consome o link. POST exige seleção e conferência explícitas, valida origem e conflitos de sala/participantes. Reenvio da mesma resposta é idempotente.
- O acesso por link concede apenas a resposta desta reserva e leitura de seu comprovante, sem permissões de conta Master ou de edição do TCC.
- O formulário não usa JavaScript, cookies ou novo código de login. A política de referência `same-origin` preserva a validação de origem no envio e impede vazamento do link a outros sites.
- Upload e confirmação manuais antigos continuam no backend para compatibilidade administrativa/histórica; a tela do aluno passa a acompanhar o resultado, sem exigir PDF.
- As estruturas novas pertencem ao agregado de processo já persistido. Nenhuma alteração de schema foi aplicada em produção.

## Apresentação dos e-mails

`operationalEmailLayout` é compartilhado por prévia e envio de mensagens do processo: tabelas com estilos inline, cor de fundo redundante em `bgcolor`, MIME HTML/texto com codificação base64 em linhas de 76 caracteres, cabeçalho verde, logo/banner configurados e um botão centralizado antes das orientações. Imagens locais do Estúdio são convertidas para referências públicas de ativos; logo institucional padrão é usado quando nenhuma imagem foi configurada. Imagens remotas ainda dependem da permissão de exibição do cliente de e-mail.

O conteúdo textual configurado é preservado antes das orientações. A seção automática é reconstruída com instruções curtas da etapa, sem introdução repetida de login ou links nas frases. O HTML de apresentação usa o envelope comum; personalizações visuais do Estúdio (cabeçalho, imagens e cor) são mantidas.

## Verificação

- Testes HTTP isolados: confirmação sem sessão/upload, seleção alternativa, rejeição de origem estrangeira, formulário incompleto, token adulterado/outro destinatário, comprovante PDF, duplicidade, revisão antiga e indisponibilidade.
- Teste de navegador: `scripts/test-department-reservation-browser.ts`; e-mail com um botão e logo carregado, formulário em computador/celular sem rolagem horizontal, envio real à API local e leitura do estado persistido.
- Evidências visuais em `.portal-data/department-review/`.
- Integrações reais Gmail/Drive e confirmação do departamento em produção ainda precisam de validação após publicação autorizada. Nenhum e-mail real foi enviado nesta verificação.


## Convite para a banca

O aviso `email-convite` gera dois envios individuais: um para cada examinador convidado, excluindo o orientador dos destinatários principais. Os autores e o orientador são copiados em ambos. Destinatários duplicados, ausentes ou inválidos bloqueiam o envio para conferência do cadastro.

Cada mensagem apresenta título, autoria, data, intervalo da defesa, local, orientação e os dois convidados. O assunto é “Convite para a banca de TCC”, seguido da autoria. As orientações automáticas são dirigidas aos convidados e tratam somente de consultar o processo e a carta-convite; o e-mail não atribui a eles tarefas de avaliação ou assinatura da orientação.

A composição é compartilhada pelo envio, prévia do Estúdio e galeria local. Esta alteração não envia convites reais nem altera as permissões de acesso ao processo.


## Avaliação, ata e entrega final — regra atualizada em 04/11/2026

O aviso de agendamento confirmado orienta o professor a acessar Avaliação e ata no dia da defesa, registrar a avaliação e prosseguir para a assinatura. O convite continua dirigido apenas aos convidados, sem essas tarefas da orientação.

Nas novas solicitações de ata, o orientador e os dois examinadores titulares são signatários, todos na prioridade 1. Autores não iniciam assinatura da ata; no Gov.br, apenas o orientador (ou a administração autorizada) devolve o PDF assinado. A exigência de avaliação concluída e a conferência das assinaturas permanecem no servidor. Documentos já assinados não são reabertos; solicitações antigas ainda pendentes, com destinatários diferentes, exigem uma nova versão antes do envio.

As instruções de Asten e Gov.br ficam em parágrafos separados. A entrega final pode ser realizada por qualquer um dos autores, após o arquivamento da ata assinada. A orientação acompanha a entrega e assina o termo quando houver publicação autorizada.


## Consolidação dos avisos finais

As antigas prévias 12 (assinatura registrada), 13 e 14 (documentos finais por perfil) foram substituídas por uma mensagem comum: assinaturas concluídas e documentos disponíveis. Ela vai a autores, orientação, coorientação quando houver, convidados da banca e presidência, com deduplicação por e-mail, processo e revisão. O departamento não recebe os documentos acadêmicos finais.

No runtime e no rascunho do Estúdio, ações de e-mail genérico em SIGNATURE_COMPLETED são retiradas; a liberação de entrega no Repositório é preservada. PROCESS_COMPLETED mantém uma única ação canônica de aviso final. Ações de documento, formulário ou sistema não são removidas. Modelos personalizados permanecem no catálogo para recuperação, mesmo quando suas antigas ações repetidas deixam de disparar.

O aviso de assinatura do Termo permanece; o aviso separado da Declaração à presidência foi retirado. A criação da Declaração e o e-mail de assinatura da Asten permanecem. Asten e Gov.br são apresentados em itens de uma lista com fonte menor; o e-mail do Portal informa a etapa e o provedor encaminha sua solicitação de assinatura. A mensagem final não menciona novas pendências nem pede correções de cadastro. A galeria foi consolidada para não apresentar as três antigas versões como notificações separadas.

Tentativas de reenviar avisos genéricos antigos são recusadas como EMAIL_CONSOLIDATED; registros históricos aceitos pelo Gmail não são modificados. Não houve envio real nem alteração de configuração em produção nesta revisão.


O cadastro recebido passou a integrar a cópia da solicitação de reserva enviada a autores e orientação. A mensagem de reserva confirmada reúne o comprovante e as instruções do antigo aviso de agendamento, incluindo a avaliação pelo orientador no dia da defesa. As ações independentes email-instrucoes-cadastro e email-confirmacao deixam de disparar; suas definições ficam preservadas no catálogo. O departamento continua recebendo apenas sua versão de comprovante, sem instruções acadêmicas.


## Texto por papel do destinatário

A cópia da solicitação recebida pelos autores e orientação apresenta a alternativa conforme preenchida no formulário e informa que ela aguarda aceite e homologação. O pedido dirigido ao departamento mantém a redação de solicitação. Na cópia dos participantes, o acompanhamento aparece uma única vez, com referência ao botão e aos avisos por e-mail; o parágrafo de espera e o rodapé genérico repetidos foram retirados.

As saudações dos e-mails do processo identificam o papel: departamento; autores e orientação; convidados; presidência; ou participantes do TCC no encerramento. Os nomes ficam nos dados do trabalho. A apresentação não muda os destinatários nem as autorizações de confirmação da reserva.


## Revisão dos nove e-mails — 26/10/2026

A galeria apresenta nove e-mails numerados em sequência. O quarto é a confirmação do preenchimento do formulário ao departamento, com duas prévias: reserva confirmada e indisponibilidade. A versão para autores identifica explicitamente esse papel; o comprovante de confirmação continua incluindo a orientação de avaliação no dia da defesa.

O convite agrupa título, autoria, data, horário, local, orientação e coorientação (quando cadastrada) em um bloco. Os dois convidados aparecem em seguida.

O aviso de ata disponível para assinatura foi retirado do fluxo e dos reenvios. As instruções de assinatura ficam em Documentos administrativos. O registro do conceito não envia solicitações à Asten; elas partem do botão do documento. O orientador e os dois examinadores titulares assinam a ata, todos na prioridade 1. O e-mail 07 dirige a entrega aos autores, com observação sem negrito de que qualquer autor pode fazer a entrega. Havendo publicação autorizada, todos aguardam o termo.

O e-mail 08 explica a preferência por Asten e o e-mail automático do provedor; autores e orientador assinam o termo no mesmo nível. Pelo Gov.br, todos assinam o mesmo PDF e o orientador devolve o arquivo completo. O aviso separado à presidência foi excluído das ações de e-mail e das tentativas de reenvio; ações documentais permanecem. O e-mail 09 avisa o encerramento a todos os participantes acadêmicos, incluindo a presidência.

Mudanças locais, sem publicação nem envio real de e-mail nesta revisão.

A entrega no Repositório informa explicitamente que aguarda as assinaturas do orientador e dos dois examinadores e o arquivamento da ata; após o arquivamento, informa a liberação para qualquer um dos autores. O aviso de entrega final já existente foi preservado, sem criar outra notificação.


## Nomenclatura do responsável

As mensagens, os rótulos de cadastro e as instruções do Portal usam “orientador” quando se referem à pessoa, inclusive na composição de modelos de e-mail salvos. O título “Orientações do processo” continua identificando as instruções. O aviso de entrega final não recomenda enviar a versão apresentada na defesa quando não houver alterações; limita-se ao envio pelo Portal e aos ajustes solicitados pelo orientador e pela banca.


## Aplicabilidade do termo e devolução Gov.br

Sem autorização para publicar o trabalho completo ou o resumo expandido, não há geração nem solicitação de assinatura do termo; o aviso de termo disponível também é excluído da execução e bloqueado no reenvio. Se qualquer opção estiver autorizada, o termo permanece aplicável. Pelo Gov.br, somente o orientador cadastrado pode devolver o termo, reunindo todas as assinaturas no mesmo PDF. O acesso administrativo de conferência não concede permissão de devolução do termo. O botão do e-mail do termo abre o TCC em Documentos do processo; o botão da entrega final abre Repositório.


A devolução Gov.br exige tantas assinaturas digitais distintas quanto os signatários esperados, incluindo três na ata. A contagem estrutural não substitui a confirmação administrativa de todos os titulares no VALIDAR/ITI. A entrega somente é liberada após o arquivamento da ata completa. Para o roteiro atual, consulte `ASSINATURA_ATA_TRES_DOCENTES.md`; as descrições de reserva e envios datadas acima registram versões anteriores.
