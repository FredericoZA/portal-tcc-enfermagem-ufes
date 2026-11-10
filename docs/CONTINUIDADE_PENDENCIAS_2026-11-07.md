# Continuidade das pendencias - 07/11/2026

Base publicada ao iniciar: 4c24f136, projeto oficial portal-tcc-enfermagem-ufes. O worktree de revisao preserva o diretorio principal e os dados locais. Nenhum TCC, assinatura, mensagem ou limpeza real foi criado/executado nesta rodada. Nao houve migracao nem mudanca de permissoes do banco.

## Causas e mudancas verificadas

| Frente / criterios | Causa confirmada | Mudanca minima | Teste e resultado | Reversao / limite |
|---|---|---|---|---|
| ASTEN / 018, 023, AC-007, AC-011 | O fallback de consulta ao provedor cobria somente ATA. Termo e declaracao dependiam do callback para atualizar o estado. | Reutilizar o fallback existente para os tres documentos ja enviados, com requisitos de etapa e revisao atual. | 24 testes focados; mesmo limite global de dois envelopes no cron, intervalo de dois minutos, Presidencia consulta somente declaracao. Sem nova mensagem ou envelope. | Reverter 20eba8bf; assinatura/retorno/Drive reais continuam pendentes. |
| Exclusao e protocolo / 020, AC-010, T-27 | Alocador ja escolhe menor lacuna. Tarefa real do 00002 esta PENDING, tentativa 1, sem flags e sem erros; conclusao nao foi registrada. | Retomar limpeza no proprio Registro de logs, usando a rota Master existente. Confere alvo atual, protocolo, lease e confirmacao; um POST. | Testes HTTP preservam 403 ao aluno e demonstram reuso do 00002 somente depois de COMPLETED, inclusive com reinicio. | Reverter 27385e5d. Nao renumerar 00003 nem liberar o 00002 por fora; limpeza real ainda nao executada. |
| Resultado de acao administrativa | Falha de onRefresh no finally escapava como rejeicao depois do resultado de retomada. | Tratar atualizacao posterior separadamente, preservar resultado e liberar interface. | 11 testes focados, incluindo refresh rejeitado e ausencia de segundo POST. | Reverter 77008d6c; aviso de atualizacao nao e autorizacao para repetir efeito externo. |
| Supabase / 029 | Primeira leitura enviava auditoria inteira e tambem a ordenava/agrupava/hashava pela RPC. Nao havia chunks conhecidos para reaproveitar. | Ler a linha canonica na primeira carga de cada endpoint; manter revisao autoritativa, copia isolada e delta nas cargas quentes posteriores. | 13 testes combinados de leitura/delta/CAS; casos de endpoint distinto, 403, estado invalido, retencao, correcao e backups. Revisao independente nao encontrou regressao de autorizacao/CAS. | Reverter 4441e3cb e 9e21643b. Reduz CPU/hash na carga inicial; pode transferir auditoria integral novamente no primeiro refresh alterado. Nao afirmar economia global de egress ou fim dos timeouts. |
| Acesso / 017, 031 | Pop-ups compactos fora do shell existente e rotulo Membro da banca para EXAMINER. | Reutilizar PortalModalShell e apresentar Examinador. | 57 testes focados e TypeScript; bloqueio durante salvamento mantido. | Reverter trechos de 8eb48b6a; aceite de teclado/visual privado continua pendente. |
| Historico / 013, 017 | Projecao legivel de snapshots antigos ainda podia mostrar matricula/SIAPE/CPF. | Omitir identificadores da tabela legivel, preservando originais e restauracao. | Teste comprova filtro sem mutacao do snapshot. | Reverter trechos de 8eb48b6a; nao foi apagado historico. |
| UFES / 004.06 | Codigo de busca e apresentacao aguardava comprovacao operacional. | Sem nova mudanca; conferencia pelo navegador real. | UFES e nome extenso: mesmos 110 protocolos; CSV: 110 registros; ficha publica com instituicao extensa, zero e-mails e sem rotulos de identificadores. | Somente 004.06 encerrado; nao confundir com aceite integral de 031. |

## Infraestrutura observada

Somente leitura no Supabase oficial, revisao 1049: auditLogs cerca de 2,42 MB de texto JSON; legados cerca de 895 kB; versoes do estudio cerca de 593 kB; processos atuais cerca de 17 kB; configuracoes cerca de 91 kB. Sao tamanhos de secoes serializadas, nao uso faturado, memoria ou arquivos PDF. Nenhum conteudo pessoal foi extraido nesse inventario.

Janela dos logs 13:47-14:02 UTC: 15 GETs da tabela de estado, todos HTTP 200, media origin_time de 224,67 ms. Essa amostra pequena e distinta nao prova ganho percentual nem capacidade para 50-60 acessos. O consumo faturado e a carga equivalente continuam como criterios abertos. Supabase documenta que leitura de dados do banco tambem gera egress; arquivos no Drive nao eliminam esse trafego.

A alternativa de leitura inicial foi escolhida para reduzir trabalho de inicializacao sem DDL. Nao remove a necessidade futura de separar de forma transacional os historicos/projecoes grandes do agregado operacional. Essa separacao requer migracao, compatibilidade, recuperacao e medicao proprias; nao foi improvisada nesta rodada.

## Navegador e retorno do responsavel

Foram registradas 30 medicoes publicas em seis paginas e cinco larguras: 390, 768, 1024, 1440 e 1920 px. O procedimento espera carregamento e transicoes antes de capturar; as amostras transitorias foram descartadas. Na amostra estavel nao houve imagem quebrada, erro JavaScript ou largura da pagina maior que a janela. Tabelas largas possuem rolagem propria. Zoom, leitor de tela e telas autenticadas nao foram declarados aprovados.

Um formulario HTML local com 12 blocos opcionais foi preparado. Gera resumo copiavel e arquivo de texto, sem fetch, scripts externos ou envio de respostas. Sintaxe JavaScript verificada; a ferramenta de navegador recusou file:, portanto nao houve conferencia visual desse formulario. O roteiro Markdown oferece alternativa equivalente no chat.

## Contagens e verificacao

Antigo: 157 de 169, 12 abertas. Novo: 245 de 324, 79 abertas, sendo 12 de legados adiadas e 67 ativas. Total de caixas abertas: 91, com sobreposicao de assuntos. A mudanca desta rodada encerra somente 004.06. As outras correcoes ampliam evidencias de criterios amplos ainda dependentes de aceite externo/visual/concorrencia.

Suite integrada da base 9e21643b: 1381 testes unitarios, 21 contratos, TypeScript, segredos, acessibilidade estatica, finalizacao, compilacao, Serverless e HTTP aprovados. Fluxo seguro: 40 de 40. A correcao posterior 77008d6c passou em 11 testes focados e TypeScript; a compilacao final considera essa correcao.

Fontes: docs/ASTEN_RECONCILIACAO_DOCUMENTOS_2026-11-07.md; output/revisao-2026-11-07/publico-segunda-rodada/; logs de CI/fluxo seguro e testes focados. O comprovante final de implantacao e separado, com commit exato e alias oficial. A publicacao nao equivale a aceite dos titulares.

Referencia: https://supabase.com/docs/guides/platform/manage-your-usage/egress
