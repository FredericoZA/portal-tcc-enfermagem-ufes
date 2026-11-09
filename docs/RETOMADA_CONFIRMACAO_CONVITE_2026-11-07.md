# Retomada da confirmação e do convite — 07/11/2026

A investigação oficial identificou timeout no arquivamento da confirmação atual e na ação DOCUMENT de LOCATION_CONFIRMED, sem e-mail de convite criado. A confirmação do local e o envio do convite são estados distintos; a ausência do convite mantém Conceito e Ata bloqueados para o orientador. Não são atribuídas notas neste Portal.

## Correção de código

- `completeReservationFollowup` agora reconhece que uma tentativa de arquivamento retornou FAILED e conserva a pendência; não tenta enviar o convite nessa situação.
- Tanto a conclusão inicial quanto a retomada nativa exigem CONFIRMACAO_LOCAL arquivada para a exata dataRevision e reservationRevision atuais. Um arquivo de outro agendamento não libera a etapa.
- A retomada pelo endpoint nativo já existente preserva ator, variáveis, ações e revisão da execução anterior. Configuração ou revisão alterada exige conferência administrativa; não é aprovada automaticamente.
- Novas execuções guardam a identidade de cada ação. Uma retomada da mesma revisão de dados/configuração reutiliza a chave, inclusive se a criação da pasta alterou uma referência derivada. Ações concluídas não são repetidas. Execuções antigas sem essa chave conservam o contexto original; a recuperação do arquivo continua exigindo identidade verificável.
- Uma execução antiga com falha DOCUMENT sem chave de ação persistida não pode ser retomada automaticamente ou pelo retry nativo se também não tiver um ponteiro de arquivo verificável. Nesse caso, o resultado continua pendente em vez de calcular outra identidade após a criação de uma pasta. Se houver ponteiro, ele ainda precisa passar pela conferência estrita no Drive; divergência não gera novo arquivo.
- Antes de renderizar novamente um convite, o Portal procura ou confere o PDF da mesma ação. Exige processo, job, tipo, lifecycle, raiz privada, permissões e hash dos bytes. Um ponteiro antigo não é aceito; duplicatas, origem divergente e integridade não comprovada permanecem como erro, sem gerar outra cópia.
- A manutenção normal recupera no máximo uma confirmação/convite com timeout por execução. Primeiro retoma a confirmação usando a rotina existente de ID reservado/candidatos de hash; somente depois de seu readback válido retoma LOCATION_CONFIRMED. Falhas de envio incerto, mensagens aceitas e revisões alteradas não entram nessa recuperação automática.
- Novas confirmações guardam a revisão do Estúdio junto ao trabalho de arquivamento. Se ocorrer timeout antes de criar o primeiro workflow run, essa confirmação normal pode ser retomada pelo responsável original, na mesma configuração. Jobs antigos sem run e sem revisão capturada não são presumidos elegíveis.
- O histórico dos destinatários do convite inclui agora o segundo examinador em additionalRecipients. Isso não cria outro envio.

## Operação existente e limite de interface

A operação nativa é POST `/api/admin/form-archives/:id/retry`, autenticada e restrita ao Master; ela arquiva e depois retoma o fluxo com seus gates. O componente legado OperationsMonitorPanel contém o botão “Arquivar novamente”, mas não foi encontrada sua montagem nas páginas atuais. Portanto esta revisão não afirma que o botão está acessível na interface publicada. Nenhum painel foi montado, nenhuma rota de atalho foi criada e nenhum endpoint foi invocado em produção por esta frente.

## Verificações

39 testes direcionados passaram, incluindo Drive read-only, integridade e isolamento, seleção de recuperação, preservação de contexto/chave, erros e gates, além de HTTP real do servidor isolado que demonstra que um arquivo antigo não libera o formulário atual que falhou. TypeScript passou. A suíte inclui regressões de evolução operacional, entrega, round21, reagendamento HTTP e orçamento de manutenção.

Os serviços externos foram isolados em testes. Nenhum processo real, estado, e-mail, arquivo ou assinatura foi criado/alterado; não foi disparada recuperação de produção. O recebimento do convite, o modelo real e a latência das chamadas Google ainda dependem da execução normal. A correção não promete eliminar todo timeout de provedor ou do Supabase.

Revisão adicional de identidade legada: 16 testes direcionados e TypeScript passaram, incluindo a reprodução de pasta alterada sem chave/ponteiro e a rejeição de ponteiro incompatível sem renderização ou upload.
