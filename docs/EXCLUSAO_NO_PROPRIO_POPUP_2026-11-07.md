# Exclusao completa acompanhada no proprio popup

Solicitacao: o responsavel nao deve precisar ir a Configuracoes, Integracoes e Plataforma ou outra tela para concluir a exclusao de um TCC.

## Antes e depois

O DELETE ja iniciava a retirada do TCC e a limpeza dos arquivos, agenda, referencias/historico e envelopes elegiveis. A interface, porem, fechava o popup e retornava a lista mesmo quando recebia HTTP202 com limpeza pendente. O texto apontava ainda para um local administrativo incorreto.

A confirmacao e o resultado agora permanecem no mesmo popup. O fluxo usual e: digitar Excluir, confirmar, aguardar a operacao e conferir a conclusao confirmada. Somente Voltar a lista/Fechar encerra o acompanhamento. Se um servico nao confirmar a limpeza, a mesma janela oferece Verificar andamento e Tentar concluir limpeza; nao exige navegacao para outra area.

## Controles preservados

- Apenas Master abre a exclusao completa. Digitacao e ID exato permanecem obrigatorios.
- O servidor continua executando os mesmos destinos e preserva modelos, outros TCCs, restricoes legais e envelopes assinados. Nenhuma regra de assinatura ou etapa academica foi alterada.
- Nova consulta de estado e exclusivamente Master, apenas leitura. COMPLETED exige registro duravel exato; tarefa ausente nao significa sucesso. Processo reintroduzido, prova ausente ou conflito permanecem UNKNOWN.
- Processo, protocolo e tarefa sao conferidos em cada retorno. Reuso do protocolo por outro processo nao autoriza limpeza do novo trabalho.
- Uma resposta de DELETE perdida nao autoriza repetir DELETE. A incerteza permanece na sessao mesmo se uma consulta imediata nao enxergar ainda a operacao; somente uma rejeicao explicita classificada de antes da mutacao permite nova confirmacao.
- Retomada consulta a tarefa atual, respeita lease e envia no maximo um POST. Nao ha polling permanente nem retentativa automatica de escrita na interface.
- Eventos de atualizacao e 404 esperados do detalhe nao fecham o acompanhamento da exclusao propria. O sincronizador global continua funcionando.
- Troca de conta/processo, desmontagem e resultados atrasados sao isolados; consultas sao canceladas e nenhum retorno antigo reabre a confirmacao.
- Nao sao expostos IDs de pastas, arquivos ou envelopes na janela.
- Prazo de DELETE/retomada alinhado ao orcamento longo ja existente de operacoes administrativas. Nao se desliga timeout nem se promete conclusao atomica entre servicos independentes.

## Verificacao

Backend: 15 testes focados iniciais e 14 finais, incluindo consulta depois de reinicio, resposta 200/202, ausencia de escrita na consulta, ausencia de prova, retorno de outro ID, retencao e 403 para aluno/Presidencia. A leitura pura tem quatro cenarios de fronteira.

Integracao/UI: 30 testes focados passaram. A revisao independente encontrou um caso de repeticao insegura apos resposta ambigua; foi corrigido antes da publicacao. A suite final do controller passou em 15 testes, incluindo timeout+NOT_STARTED posterior, erro 5xx, ACK invalido, clique duplo, lease, troca de identidade e leitura tardia apos reativacao. TypeScript e diffcheck passaram.

Suite integrada: 1402/1402 testes e 21/21 contratos, acessibilidade estatica, finalizacao, compilacao, empacotamento Serverless e HTTP aprovados. Os testes finais de ambiguidade sao registrados separadamente, pois foram acrescentados durante a rodada integrada. O comprovante de publicacao registra o commit final.

Nao foi excluido nenhum TCC real, nao foram apagados arquivos reais, nao houve mensagem/assinatura no provedor nem alteracao de dados/esquema de producao para testar. O aceite real permanece com o responsavel no fluxo normal. Falha real de um servico pode manter pendencia; a interface nao a mascara como conclusao.

## Recuperacao

Commits pequenos: ad96bc1c (consulta de estado e resposta completa), 63207c18 (acompanhamento no dialogo), 947f24b9 (protecoes contra resposta ambigua). Os registros de exclusao continuam compativeis e duraveis; reverter a interface nao exige apagar historico ou liberar numeros manualmente. A versao anterior publicada foi 36ad96e7.

A nova solicitacao e MAN-003 no acompanhamento manual. As caixas amplas dos checklists anteriores nao foram encerradas por testes isolados; a exclusao externa e o reaproveitamento de protocolo ainda exigem evidencia real.
