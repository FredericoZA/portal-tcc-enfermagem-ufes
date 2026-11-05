# Auditoria de envios e atividades

Em Configurações → Registro de logs, o Master pode consultar as atividades do Portal e os registros de envio no mesmo histórico. Os filtros separam atividades e e-mails; a busca considera nomes, e-mails, protocolo, título, assunto e cópias.

Cada envio aparece uma vez, com o estado mais recente. Em Detalhes ficam o solicitante original, a conta Google de envio quando registrada, os destinatários, as cópias efetivas, o assunto e as tentativas. A mensagem é consultada como texto, preservado no momento da última tentativa realizada, sem expor códigos de acesso ou links pessoais. Uma nova tentativa administrativa não muda o solicitante original. Registros antigos sem esses dados indicam que eles não foram registrados; não há reconstrução fictícia de um envio passado.

O histórico distingue:

- Solicitação de reserva registrada: pedido salvo; ainda não significa envio de e-mail.
- Aguardando envio: nenhuma tentativa registrada.
- Nova tentativa pendente: tentativa com falha e horário de elegibilidade para repetição registrado.
- Envio em processamento: existe uma tentativa em andamento com prazo de processamento válido.
- Resultado do envio não confirmado: é necessário conferir no Gmail antes de repetir; o Portal não oferece reenvio enquanto houver essa incerteza.
- Aceito pelo Gmail: o serviço aceitou a mensagem. Não comprova recebimento, leitura ou ausência de filtragem por spam.
- Falha no envio: tentativas encerradas sem aceite do Gmail.
- Solicitação de código não concluída: a solicitação pode ter falhado antes de contatar o Gmail.

Em Configurações → E-mails, somente o Master pode ativar ou desativar **Auditar envio de e-mails**. Quando ativada, os e-mails enviados pelo Portal incluem o e-mail do Master atual em cópia, com o mesmo conteúdo completo enviado ao destinatário, inclusive códigos de acesso e links pessoais; não há um destinatário separado para editar. Desativar a opção interrompe essa cópia e mantém os envios normais aos participantes. O endereço do departamento continua sendo o responsável configurado nos e-mails e fluxos. A cópia não duplica quem já é destinatário nem provoca reenvio de mensagens antigas já aceitas. As tentativas pendentes seguem a opção e o Master atuais, preservando os destinatários do fluxo. Na instalação UFES, a ausência da opção salva mantém a auditoria já existente; instalações replicadas precisam ativá-la explicitamente.

A mensagem do responsável pela reserva contém os botões pessoais de aceitar/recusar. Com a auditoria ativada, o Master recebe a cópia completa dessa mensagem; os autores e os demais destinatários do aviso informativo não recebem esses botões. A cópia completa fica na caixa de e-mail do Master e não torna códigos ou links pessoais visíveis nos logs. Nesses registros, o conteúdo sensível continua oculto e a consulta exige acesso do Master. Uma decisão pelo link registra o endereço para o qual ele foi emitido; não comprova independentemente a identidade de quem clicou.

O Asten encaminha seus próprios convites de assinatura, fora do serviço de envio do Portal. O Portal registra a solicitação e a confirmação do provedor no histórico de assinaturas; não presume recebimento do e-mail externo nem possui uma réplica de seu conteúdo. A opção de auditoria do Portal não acrescenta o Master como signatário e não produz uma cópia idêntica desses convites externos. O recurso de [observadores do Asten](https://ajuda.astenassinatura.com.br/article/58-observadores-de-envelopes) dá acesso ao envelope após todas as assinaturas e não equivale à cópia de cada convite pessoal.

Os endpoints de auditoria e prévia são restritos ao Master e usam `private, no-store`. A prévia não executa HTML. A listagem de envios não expõe os corpos, chaves de idempotência ou variáveis internas. O armazenamento segue a retenção operacional já existente: até 10 mil registros de envio e 5 mil eventos no snapshot; não se trata de um arquivo ilimitado de mensagens.

Testes locais e integrações simuladas não comprovam que um e-mail real chegou. A validação operacional deve conferir a mensagem no destinatário e na cópia institucional depois da publicação autorizada.
