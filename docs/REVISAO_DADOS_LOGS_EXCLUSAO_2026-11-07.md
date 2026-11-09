# Dados, logs e exclusão — revisão de07/11/2026

## Campos e instituições (002/004)

| Papel/origem | Nome | Instituição | Vínculo | Fonte de apresentação |
|---|---|---|---|---|
| Autores1/2 novos | aluno1.nome/aluno2.nome | instituição acadêmica quando existente | email privado | nome público, e-mail restrito; sem matrícula |
| Orientador novo | orientador.nome | perfil institucional por extenso no repositório | orientador.email privado | publicRepositoryView; pedido direto do usuário prevalece sobre abreviar tudo |
| Examinadores | banca[].nome | banca[].instituicao | banca[].funcao/membroTipo/email | valor explícito preservado; falta só recebe UFES com nome+e-mail exatos do catálogo |
| Coorientador | coorientador.nome | coorientador.instituicao | email privado | não se converte em examinador/signatário por esse papel |
| Legado | autores/orientador/examinadores originais | campos de origem | proveniência histórica | não inferir ausência de vínculo pelo cadastro atual; complementação adiada |

server/ufesFacultyInstitution.ts contém32pares nome/e-mail da fonte institucional conferida em07/11. Instituição externa explícita prevalece, inclusive homônimo. publicViews.test.ts cobre esses casos. A atualização administrativa usa a rota autenticada PATCH do processo com validação de papel, revisão, composição distinta e auditoria EDICAO_DADOS_PROCESSO; não há reescrita automática dos registros históricos.

Mapa completo de apresentação por superfície: docs/AUDITORIA_PUBLICA_2026-11-07.md. O nome extenso exigido diretamente para o orientador foi mantido, sem substituição geral por UFES. institutionSearchText acrescenta somente aliases de pesquisa quando o campo é exatamente UFES ou Universidade Federal do Espírito Santo. O texto exibido/persistido não muda. Calendar/repositório passam a pesquisar a instituição, além de nomes/título/protocolo. Os dois rótulos antigos de membros na exportação de defesas viraram Examinador1/2.

## Indicadores (005/006/009)

A interface pública usa cadastrados, defendidos e concluídos; indicadores de publicação deixaram da apresentação pública. Estado de autorização/publicação permanece internamente e nos controles do arquivo: autorização não é qualidade, nem conclusão acadêmica. Gráficos de amostra insuficiente são omitidos, não apresentados como zero. A mesma base validada alimenta contagens e percentuais; dias/turnos não são inventados para fontes só com data.

Decisão explícita do responsável em07/11 substitui os blocos configuráveis: coletar período acadêmico declarado pelo aluno, opcional e somente estatístico. Sem comprovante de matrícula, sem dedução pelo calendário e sem janelas bimestrais inventadas. A dimensão conta cadastros por período informado; não é prova de defesa realizada nem média por duração de bloco. Ano/mês real de defesa continuam separados. Filtros dos gráficos têm escopo no rótulo e usam apenas categorias já divulgadas.

## Logs e ordenação (021/023/024)

| Campo canônico | Origem/regra |
|---|---|
| Data/hora | timestamp UTC persistido; formatação em São Paulo |
| Ordem | timestamp numérico decrescente, desempate estável por ID; cursor usa ambos |
| Quem iniciou | actorEmail/actorRoles; actorName quando conferido; sistema sem autoria humana inventada |
| Processo/entidade | processProtocol, processId e entityType/entityId autorizados; histórico pode conservar protocolo sem restaurar processo |
| Operação/resultado | action e after.status; rótulos em português; solicitado, aceito pelo Gmail e assinado são estados distintos |
| Tentativa/correlação | ID da entrega/job, tentativas, evento e revisão usada, horário; reenvio mantém mensagem/ato e novo registro de autoria |
| Segurança | safeAuditValue remove OTP, links pessoais, tokens, segredos, base64, HTML/PDF e identificadores desnecessários |

Catálogo de77eventos e matriz editorial em docs/revisao-editorial-2026-11-07. UI AuditLogDetails oferece resumo, tabelas de alterações/tentativas e controle contextual; acesso administrativo continua autenticado. A consulta do feed é uma projeção sem writes, efeitos externos ou criação de eventos. auditFeed.test.ts e auditFeedHttp.test.ts confirmam estabilidade em consultas repetidas, proteção de conteúdo e referências. Ordenação foi exercitada com103eventos no mesmo segundo, inserção entre páginas e viradaUTC/dezembro/janeiro sem duplicar registros. auditLogPresentation.test.ts cobre data civil deSãoPaulo.

## Exclusão automática (019/020)

Inventário da cadeia executável: server.ts DELETE /api/processes/:id; processDeletionTask; deleteProcessDriveArtifacts; deleteProcessCalendarEvents; deleteProcessSupabaseObjects; purgeSupabaseProcessHistory; reconcileDeletedAstenEnvelope; cronstorage-cleanup. Não há chamada a simulador, cadastro acadêmico ou envio de convite no fluxo de exclusão. Teste HTTP bloqueia qualquer provedor externo inesperado no cenário local.

Antes do primeiro efeito: requer sessão, administração, confirmaçãoEXCLUIR+IDesperado, bloqueio de operações em andamento e retenção legal. Registra intenção com ID único e persiste a retirada do processo/vínculos. Apenas Master elimina recursos externos; Presidência não ganha esse poder por conveniência. Arquivos/modelos/raízes e referências de outro TCC ficam protegidos. Tokens/revisões de arquivos eliminados deixam de dar acesso porque as rotas revalidam o processo.

São tratados cadastro, vínculos, rascunhos, reservas/eventos, convites/recibos/PDFs referenciados, versões, formulários, jobs, publicações e cache por revisão. Supabase temporários são removidos porprocess_external_id, sem apagar tickets de outro processo. Originais de backup não são reescritos; restauração que recriaria processo excluído é recusada. Mensagens já recebidas por terceiros e envelopes assinados não são declarados apagados. Asten conserva os assinados; cancelamento de envelope não assinado exige autorização contratual própria e vínculo verificado. Falta de permissão no provedor mantém pendência real.

Retomada usa lease, até7tentativas, seleção pornextRetryAt e limite de2tarefas por cron; tarefas em intervenção não são repetidas cegamente. Falha parcial conserva o motivo e não afirma100%. Nesta rodada foi removida da tela de Configurações a caixa Limpezas deTCC pendentes, mantendo a situação no Registro de logs que já existe. O feed projeta as tentativas/erros do mesmo evento, sem polling extra, novas linhas, novas telas ou ações equivalentes. O código do componente antigo ficou sem uso como referência local; não está montado na aplicação.

### Provas e limites

processCompleteDeletionHttp.test.ts confirma retirada pública/privada, restart, vínculos derivados/manual, outroTCC preservado, callback tardio ignorado, retenção e tentativa de restaurar registro excluído. processDeletionDrive.test.ts cobre árvore paginada, ambiguidade, modelos, arquivo fora da raiz e versões. processDeletionPlatforms.test.ts cobre falha deStorage preservando inventário, Calendar e agendamento limitado. workflow/astenDeletion.test.ts cobre assinatura existente, vínculo inconclusivo e cancelamento permitido. auditFeed.test.ts verifica acompanhamento sem mutação/segredos. São provas de implementação e contratos; a exclusão pontaaponta em provedores reais permanece no roteiro manual, sem cancelar processo/envelope de ninguém para preencher caixa.

## Causa → mudança → verificação → reversão

| ID | Causa confirmada | Mudança | Efeito e verificação | Reversão |
|---|---|---|---|---|
|020.07/021.04 | painel extra acionava consulta própria a cada minuto e duplicava acompanhamento |90e0601d remove montagem; mesmos dados no log existente | teste da projeção sem efeitos e sem IDs privados; lint | revert90e0601d; nenhuma mudança de dados |
|004.06 | busca de texto não incluía instituições nem reconheciaUFES/nomeextenso |2cb7ac20 acrescenta alias apenas na pesquisa e corrige exportaçãoExaminador | teste homônimo/externo/normalização; sem mutação | revert2cb7ac20 |
|010.03 | texto não explicava concentração curricular final |a2af276c fonte oficial página4 e redação limitada à organização regular | fonte normativa conferida; sem regra nova no fluxo | revert a2af276c |
|029/Autenticação | servidor pedia5s, cliente repetia250/750ms |79658619 respeitaRetryAfter com limite de tentativas |3testes de relógio/403/429 e prazo longo | revert79658619 |

Nenhuma destas correções criou novo papel, liberou etapa de processo ou exigiu alteração nosTCCs existentes.
