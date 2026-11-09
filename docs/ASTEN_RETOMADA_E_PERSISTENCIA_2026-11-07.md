# ASTEN — preparação e persistência da solicitação

## Problema observado

Na consulta real de 7 de novembro, a solicitação da ata do TCC - 00003 estava com PDF original no Drive, estado PROVIDER_ERROR e erro de timeout. Não havia envelope externo, data de encaminhamento ou claim de criação. A mesma situação foi conferida na interface Master, em Registros de Assinatura → Auditar, na versão 224f112. Isso comprova interrupção anterior à criação do envelope; não identifica sozinho qual dependência esgotou o prazo.

Os logs do período registraram commits agregados lentos e falhas de tempo limite. A atualização de um status de assinatura ainda podia reenviar e reprojetar o estado completo do Portal.

## Correção

- Remover a gravação preparatória de SENDING anterior às leituras de pasta e PDF.
- Preservar claim exclusivo e confirmação durável de CREATING antes da criação externa.
- Preservar confirmação durável de SENDING antes do encaminhamento externo.
- Identificar a etapa de timeouts de preparação sem reproduzir detalhes privados da exceção.
- Atualizar apenas solicitações de assinatura já existentes quando nenhuma outra seção do estado mudou. Alteração de processo, configuração, auditoria ou criação de solicitação continua pelo commit completo.
- Manter revisão global, comparação e troca (CAS), transação, projeções e hash canônico. Confirmação ambígua exige leitura exata; não autoriza repetição cega.

Documentos continuam no Drive. A nova operação SQL contém metadados e não passa a armazenar PDFs no Supabase.

## Limite da validação

Testes locais não comprovam encaminhamento real pela ASTEN. A solicitação antiga da ata possui três signatários e não deve ser convertida silenciosamente para a política de quatro a seis participantes. Para aplicar a nova política a esse registro, é necessária a reabertura formal e a conferência da nova ata pelo orientador no fluxo existente.

O registro de publicação, instalação da migration e eventual retomada real deve ser acrescentado após cada execução confirmada.

## Instalação e decisão do piloto

A migration `20261107202908_signature_job_scoped_commit` foi instalada no projeto oficial. A leitura do catálogo confirmou ambas as funções como SECURITY INVOKER, sem execução para anon/authenticated e com execução para service_role. A revisão de dados permaneceu 1128 antes/depois da instalação. O Advisor manteve apenas as quatro observações informativas anteriores de RLS sem política pública nas tabelas privadas do backend.

O usuário informou que fará pessoalmente a reabertura e a nova conferência da ata. Não foi acionado Reenviar, não foi criado envelope e não foram modificados os três signatários da solicitação antiga nesta intervenção. A comprovação do encaminhamento real da nova ata permanece pendente da nova versão registrada pelo orientador e da resposta da ASTEN.
