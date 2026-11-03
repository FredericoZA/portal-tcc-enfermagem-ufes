# Reinício da solicitação de reserva

Alteração local aguardando publicação autorizada.

Na fase inicial da reserva, mudar data, horário ou local retorna o processo à
confirmação do local. O comprovante e a confirmação anteriores deixam de ser
ativos, mas permanecem referenciados no histórico, sem apagar arquivos do Drive.
O prazo da confirmação recomeça na data dessa alteração.

O novo evento RESERVATION_RESCHEDULED executa somente a ação de e-mail da reserva
publicada, preservando o destinatário do departamento e os participantes em cópia.
Não repete formulários iniciais nem mensagens de boas-vindas. O transporte registra
falhas e a interface indica envio pendente; não informa sucesso sem aceite do provedor.
Salvar valores idênticos não cria novo pedido. O reenvio manual de uma entrega antiga
é recusado se sua revisão de reserva já foi substituída.

A tela explica o reinício antes da edição e limpa o arquivo selecionado e a marcação
de recebimento quando muda a revisão da reserva. Uma nova confirmação exige novo
comprovante; tickets de upload anteriores não podem ser usados na revisão nova.
O comprovante substituído continua versionado no histórico.

Esse reinício é da etapa de reserva anterior à emissão do convite e aos documentos
da defesa. Não cancela envelopes ou documentos assinados de etapas posteriores.
A regra anterior de correção administrativa de agendas emitidas permanece separada.

No e-mail de solicitação, o botão único do TCC fica centralizado, em parágrafo
próprio, imediatamente antes do título Orientações do processo.

Verificações locais: testes HTTP com estado persistido e pendência real de integração
não configurada; engine com Gmail simulado para aceite/idempotência; revisão de
reserva e histórico; prazos; rejeição de solicitante sem vínculo; prévia e navegador.
Nenhuma solicitação real foi enviada ao departamento durante esses testes.
