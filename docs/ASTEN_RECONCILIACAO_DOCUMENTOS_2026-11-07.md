# ASTEN: recuperação de atualização do termo e da declaração

## Falha encontrada

A consulta autenticada de assinaturas e a contingência diária consultavam o estado no provedor apenas para ATA. Os observadores do navegador consultam o estado local dos jobs; não falam diretamente com ASTEN. Se o retorno de TERMO ou DECLARACAO não chegasse à fila, o documento poderia permanecer como enviado no Portal mesmo após assinatura. Esse caso é distinto da restrição EXAMINER corrigida anteriormente e da confirmação de gravação no Supabase.

## Correção

O mesmo mecanismo limitado de consulta agora aceita os três tipos já assináveis. Não cria ou reencaminha envelopes, não gera e-mail, não introduz rota, novo timer ou papel. O retorno normal continua sendo a via principal; a consulta recupera o estado do envelope existente.

- Mantém intervalo de dois minutos por envelope e bloqueio de consulta concorrente na instância.
- A contingência diária mantém no máximo dois envelopes no total, com orçamento de execução existente. `ataChecks` continua contando somente atas; `signatureChecks` indica o total.
- Não consulta jobs removidos, cancelados, de outra revisão/processo, sem ID externo, ainda em despacho ou de outro provedor.
- O termo e a declaração exigem entrega confirmada e ata arquivada; também passam pelos requisitos compartilhados de aplicabilidade/autorização. A declaração continua exigindo termo aplicável arquivado. Um arquivo válido por outro job encerra a consulta concorrente da mesma versão.
- A Presidência com acesso apenas à declaração pode provocar somente a conferência dessa declaração. A projeção da resposta permanece filtrada; o acesso ao restante do processo não foi ampliado.
- Estado do provedor idêntico não gera gravação do agregado. Assinatura confirmada passa pelo arquivamento e pela conferência de signatários/bytes já existentes antes de liberar etapas.

## Provas executadas

24 testes passaram: elegibilidade dos três tipos, intervalo, cancelamento/remoção, revisão, arquivo concorrente, gates de entrega/ata/termo, execução real da função de consulta com portas isoladas, ausência de despacho e de gravação sem mudança, limite de um agendamento em andamento, escopo da Presidência, cadeia pós-arquivamento e contratos de assinatura. TypeScript e `git diff --check` passaram.

O teste de função executa o corpo real extraído do servidor com serviços isolados; não é prova de retorno real do provedor. Não foi criado processo, envelope, e-mail ou assinatura pessoal nesta revisão. Recebimento real, retorno, assinatura dos titulares e guarda no Drive permanecem como aceite institucional pendente. Não há promessa de atualização instantânea nem de ganho financeiro/capacidade a partir destes testes.
