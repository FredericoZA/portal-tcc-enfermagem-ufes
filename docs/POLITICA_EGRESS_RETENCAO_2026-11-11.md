# Política de Egress e retenção — Portal TCC (11/11/2026)

Atualização técnica de 17/11/2026: projeções condicionais de assinaturas e catálogo, com revisão e permissões atuais preservadas.

## Fonte canônica

- O Supabase mantém os estados operacionais e provas de auditoria necessárias.
- O Google Drive institucional é fonte dos arquivos definitivos. PDFs, DOCX e imagens permanentes não devem ser copiados ao snapshot do runtime.
- O repositório histórico de TCCs **não é limitado** a 20 trabalhos nem é excluído após conclusão.

## Leituras

1. GETs revisados usam `LEAN`, sem auditoria e sem acervo legado, ou `LITE`, sem auditoria e com o acervo legado. A RPC `portal_read_runtime_projection_v1` compara o fingerprint da projeção com a cópia já confirmada pelo servidor. Se o conteúdo não mudou, devolve a revisão atual e o hash, sem repetir o payload. As RPCs anteriores `portal_read_runtime_lean_v1` e `portal_read_runtime_lite_v1` mantêm a compatibilidade durante atualização do banco.
2. O acompanhamento de assinaturas usa `SIGNATURES`, pela RPC `portal_read_signature_projection_v1`, somente nos GETs de assinaturas do TCC, de jobs e das filas da Presidência. A projeção contém configurações, processos, vínculos, acessos autorizados, revogações e jobs de assinatura. Mudanças nessas entradas invalidam o fingerprint; alterações apenas em e-mails, auditoria ou versões do Estúdio não obrigam a retransmitir essas coleções para essa consulta.
3. O catálogo usa `portal_read_repository_projection_v1`, que calcula o fingerprint da projeção existente `portal_read_repository_v1`. Uma revisão global de outra coleção pode confirmar o mesmo catálogo sem retransmiti-lo. A projeção conserva a prova do hiperlink na linha histórica, o tipo de arquivo e os controles de recusa, retirada e publicação. O servidor continua filtrando a resposta pública.
4. As novas RPCs são somente leitura, `SECURITY INVOKER`, com execução exclusiva de `service_role`; não concedem leitura a `anon` ou `authenticated`. Cada resposta vincula conteúdo ou fingerprint à revisão real da mesma leitura PostgreSQL. Uma instância aquecida só reutiliza a cópia quando o banco confirma a revisão ou o hash correspondente. Coleções omitidas por projeções parciais não substituem coleções completas no runtime.
5. RPC ausente, confirmada por HTTP 404 e `PGRST202`, permite compatibilidade: `SIGNATURES` usa o leitor `LEAN` confirmado, e o catálogo usa a RPC anterior. Há espera limitada antes de tentar novamente a RPC ausente. Acesso negado, erro de leitura, payload inválido ou hash incompatível não autorizam servir cache antigo.

## Escritas e fronteira de CAS

Projeções parciais nunca preenchem o cache canônico usado como base de gravação. Mutações, atos documentais, restauração e caminhos não revisados exigem o estado completo e o commit transacional com a revisão esperada (CAS). As tarefas de recuperação iniciadas pelo acompanhamento de assinaturas adquirem sua própria posição na fila e carregam o estado completo antes de executar workflows ou chamar provedores. O estado global não pode ser trocado enquanto uma operação protegida o modifica.

O patch reduz o corpo enviado ao banco, mas o agregado canônico e a projeção serializada atual ainda são gravados. A redução de payload não significa eliminação de escrita, de processamento PostgreSQL ou de tráfego em todos os caminhos.

## Medição e limites de interpretação

A migração `20261117030854_conditional_signature_and_repository_reads.sql` foi instalada e conferida no Supabase oficial em 17/11/2026, preservando a revisão 1576. As consultas de tamanho retornaram somente métricas, sem baixar o payload privado completo. O payload lógico de `SIGNATURES` tinha 238.973 bytes; os tamanhos das linhas JSON, incluindo revisão e fingerprint, foram:

| Projeção | Primeira linha JSON | Linha com conteúdo inalterado |
| --- | ---: | ---: |
| `SIGNATURES` | 239.087 bytes | 118 bytes |
| Catálogo | 485.521 bytes | 118 bytes |

Essas medidas são tamanhos lógicos de JSON, sem cabeçalhos ou compressão do transporte; não são bytes faturados, medição de latência ou previsão mensal. A instalação das funções no banco e a utilização pelo aplicativo publicado exigem verificações distintas. A redução efetiva depende das rotas utilizadas, das alterações ocorridas e da quantidade de instâncias iniciadas.

A franquia e o consumo atuais do projeto e da organização aguardam conferência no painel autenticado. Capturas de 11/11 e 15/11 são evidências históricas de seus próprios períodos; não comprovam saldo ou restrições atuais. Ao medir, registrar projeto, período, serviço e variação diária, sem tratar um valor acumulado como taxa de consumo.

## Log Query

`Log Query` mede os bytes de logs da plataforma examinados pelas consultas no Studio, na Management API, na CLI ou em outra interface de leitura desses logs. Não mede o tamanho do Registro de Logs do Portal, a quantidade de consultas SQL comuns ou o tamanho da tabela `portal_audit_events`. Apagar a auditoria acadêmica não desfaz o volume de logs já varrido.

Para investigar, limitar a janela e aplicar os filtros antes da consulta; evitar polling do Logs Explorer. Consultas repetidas podem examinar novamente os mesmos logs. Confirmar franquias e regras vigentes na documentação e no painel, sem inferir cobrança a partir do tamanho das respostas SQL. Referência: [Manage Logs Query usage — Supabase](https://supabase.com/docs/guides/platform/manage-your-usage/logs-query).

## Retenção e expurgo automático

- Rascunho de cadastro: o fluxo de criação elimina o rascunho; o mecanismo existente expira rascunhos antigos.
- Rascunho de avaliação: eliminado na conclusão da avaliação; a manutenção diária remove resíduos **somente** após status CONCLUIDO, avaliação concluída, dados finais entregues e ata comprovadamente arquivada.
- Logs de auditoria com prova de ato acadêmico, autorização, assinatura, administração, documentos e defesa: preservar até que haja prazo de guarda institucional aprovado; não adotar janela arbitrária de 20 TCCs.
- Registros temporários do transporte privado: manter limpeza de uploads/downloads expirados, já implementada na rotina diária.
- Históricos de configurações: impedir a segunda cópia integral do estado futuro. Para os antigos, usar somente o script de manutenção com comparação exata com `portal_audit_events`, backup no mesmo commit, e leitura privada para restauração.

## Validação e recuperação

- O procedimento de compactação histórica não roda automaticamente em novas instalações e exige suporte de leitura publicado antes.
- Não truncar ou eliminar dados do histórico normalizado, backups documentais, catálogo legado, assinaturas e referências do Drive.
- Registrar revisão de origem/destino, número de eventos elegíveis, bytes reais de Egress antes/depois e ausência de falhas 402.
- Uma diminuição do tamanho de um payload não garante consumo mensal dentro da franquia vigente: revisar volume de solicitações, inclusive inicializações de instâncias e métodos mutáveis.
