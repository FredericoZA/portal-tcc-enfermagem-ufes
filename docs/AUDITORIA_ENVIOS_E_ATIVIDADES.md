# Auditoria de envios e atividades

Em Configurações → Registro de logs, o Master pode consultar as atividades do Portal e os registros de envio no mesmo histórico. Os filtros separam atividades e e-mails; a busca considera nomes, e-mails, protocolo, título, assunto e cópias.

Cada envio aparece uma vez, com o estado mais recente. Em Detalhes ficam o solicitante original, a conta Google de envio quando registrada, os destinatários, as cópias efetivas, o assunto e as tentativas. A mensagem é consultada como texto, preservado no momento da última tentativa realizada. Uma nova tentativa administrativa não muda o solicitante original. Registros antigos sem esses dados indicam que eles não foram registrados; não há reconstrução fictícia de um envio passado.

O histórico distingue:

- Solicitação de reserva registrada: pedido salvo; ainda não significa envio de e-mail.
- Aguardando envio: nenhuma tentativa registrada.
- Nova tentativa programada: tentativa com falha e horário de repetição registrado.
- Aceito pelo Gmail: o serviço aceitou a mensagem. Não comprova recebimento, leitura ou ausência de filtragem por spam.
- Falha no envio: tentativas encerradas sem aceite do Gmail.
- Solicitação de código não concluída: a solicitação pode ter falhado antes de contatar o Gmail.

Na instalação `ufes-enfermagem`, os avisos operacionais acrescentam `tccenfermagemufes@gmail.com` em cópia. O endereço do departamento continua sendo o responsável configurado nos e-mails e fluxos. A cópia não duplica quem já é destinatário nem provoca reenvio de mensagens antigas que já foram aceitas. A regra institucional não é aplicada automaticamente a cursos que replicarem o Portal com outra identificação.

Os botões pessoais de aceitar/recusar a reserva permanecem somente na mensagem do responsável. A cópia informativa ao grupo inclui a conta de auditoria. Códigos de acesso e links pessoais de decisão/assinatura não são distribuídos por cópia nem expostos na prévia dos logs. Para esses casos, a auditoria apresenta metadados. Uma decisão pelo link registra o endereço para o qual ele foi emitido; não comprova independentemente a identidade de quem clicou.

O Asten encaminha seus próprios convites de assinatura. O Portal registra a solicitação e a confirmação do provedor no histórico de assinaturas; não presume recebimento do e-mail externo nem possui uma réplica de seu conteúdo.

Os endpoints de auditoria e prévia são restritos ao Master e usam `private, no-store`. A prévia não executa HTML. A listagem de envios não expõe os corpos, chaves de idempotência ou variáveis internas. O armazenamento segue a retenção operacional já existente: até 10 mil registros de envio e 5 mil eventos no snapshot; não se trata de um arquivo ilimitado de mensagens.

Testes locais e integrações simuladas não comprovam que um e-mail real chegou. A validação operacional deve conferir a mensagem no destinatário e na cópia institucional depois da publicação autorizada.
