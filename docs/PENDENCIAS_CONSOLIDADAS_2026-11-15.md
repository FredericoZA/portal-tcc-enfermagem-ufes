# Portal TCC — consolidação das pendências

## Limite desta rodada

Pedido atual: recuperar e concluir os trabalhos deixados em aberto, sem publicar no Vercel. Revisão de código local separada, base main d9ff1222f1ec6ab7f67ae6103733e09531c8d146. Preservar arquivos, configurações e dados da pasta de desenvolvimento original. Nenhuma edição em processos, assinaturas, arquivos ou configurações de produção.

## Fontes recuperadas

- Pedidos desta conversa, inclusive correções e cancelamentos posteriores.
- Documento de melhorias v0.2 (R01–R08) e v0.3 (R01–R11), comparados anteriormente.
- Artefatos de economia/conferência de 11/11 e revisão de 15/11.
- Checklists de 05/11, 06/11 e decisões de 08/11 na pasta de desenvolvimento original. As decisões posteriores e o teste ponta a ponta relatado pelo usuário prevalecem sobre marcações antigas.
- Conversa arquivada “Portal TCC — desenvolvimento local”.
- Quatro chamados de geração de correções de segurança, identificados abaixo.

## Trabalho de código e verificações

| Item | Situação verificada | Evidência principal |
|---|---|---|
| Auditoria enxuta | Implementação local; preserva controles operacionais e cópias de e-mail | server/criticalAuditPolicy.ts; server/auditFeed.ts |
| Redução de leituras Supabase | Implementação local e migração aditiva preparada | server/runtimeReadProjection.ts; supabaseConditionalProjection.test.ts |
| Conferência pré-ata | Cinco abas, sem motivo obrigatório, e-mail do orientador bloqueado e aviso documental | ProcessDataReviewModal.tsx; processProtocolHttp.test.ts |
| Datas passadas/futuras e noite | Implementado; dias úteis e conflito de 90 minutos preservados | reservationChange.ts; testes HTTP da conferência |
| Calendário mensal e faixa diária | Implementado e navegado localmente; legenda e dias úteis | ReservationCalendarPicker.tsx; capturas output/playwright |
| R01–R03/R05–R08 | Alterações locais; apresentação completa ainda deve ser conferida em telas estreitas | HomePage.tsx; StudentNames.tsx; academicTextCase.ts; CSS |
| R04 fases | Catálogo compartilhado entre listagem e ficha; não altera etapas persistidas | processStagePresentation.ts; formatters.test.ts |
| R07 títulos em caixa alta | Prévia opcional de capitalização, aplicação explícita no formulário e grafia revisada preservada no servidor/listas; nenhum lote histórico | reviewedTccTitle.test.ts; processProtocolHttp.test.ts; capturas 09–10 |
| Configurações de fluxo/formulários/e-mails | Já há seleção de papéis, confirmações de inclusão/publicação, quatro versões e restauração | IntegrationStudioPanel.tsx; STUDIO_VERSION_LIMIT=4 |
| Master acelerar processo | Coluna e diálogo já montados; confirmação de reserva e retomada com gates, sem afirmar assinatura pelo signatário | AuditLogsPage.tsx; WorkflowRecoveryPanel.tsx |
| E-mail final agrupado/assinaturas/exclusão | Preservar fluxo atual; verificar pelos testes existentes, sem disparar novo processo real | evaluationHttp.test.ts; testes de assinatura e exclusão |
| Suíte completa | 1.967 casos: 1.966 passaram e um falhou por transporte HTTP; o teste original de avaliação passou depois isoladamente. Os grupos alterados no fechamento também passaram | unit-suite-final.log; audit-evaluation-final.log; title-review-http.log; studio-autosave-final.log |

## Outros chamados de segurança recuperados

Os quatro chamados eram solicitações antigas de geração de patch, com snapshot de outubro e limitações do workbench. Não reutilizar tokens encerrados, aplicar patches antigos cegamente nem marcar achados como formalmente encerrados.

| Chamado | Proteção encontrada no código atual | Verificação |
|---|---|---|
| Upload público de PDF (occ_d34bd612d85e250c785cb3f2) | Verificação por hash no navegador e bloqueio do upload público | server/publicPdfVerification.test.ts |
| Tentativas de OTP de outro navegador (occ_87de1c007f033fe8d0cbeb5d) | Desafio vinculado por cookie HttpOnly, validação antes de consumir tentativas | server/security/portalOtpBinding.test.ts |
| Reatribuição de Master no OAuth (occ_d55b61a4b592de0315853678) | Política do Master atual e revogação da autorização | server/security/googleOAuthPolicy.ts e testes |
| Fila ilimitada de requisições (occ_d82f1bf1093b893ea0aa25d0) | Limite, timeout e cancelamento de espera | server/runtimeRequestQueue.test.ts |

A existência das proteções e o resultado dos testes atuais são distintos do estado formal dos chamados no workbench. Nenhuma etapa formal de segurança foi avançada nesta rodada.

## Organização do GitHub executada

- Confirmadas zero PRs abertas antes da limpeza.
- Removidas 40 branches cujos commits já eram ancestrais da main.
- Arquivadas e removidas outras 131 branches antigas, sem mesclar seu código no aplicativo.
- Todas as 171 pontas conferidas contra bundle de recuperação com histórico completo antes da remoção. Remoções atômicas e condicionadas ao SHA para não apagar uma atualização concorrente.
- Readback confirmou apenas refs/heads/main, sem alteração do seu commit.
- Evidências: output/revisao-20261115/*branch-cleanup*.json e .log; branches-antes-da-limpeza.bundle.

## Itens que não podem ser marcados como concluídos por testes locais

- Publicação Vercel e aplicação da migração Supabase: suspensas por instrução atual.
- Redução mensal de egress e limite de 5 GB: exigem janela de medição após publicação.
- Entrega real de e-mail, assinatura de pessoas, permissões de arquivos reais e expurgo externo: não executar um novo fluxo ou exclusão apenas para preencher checklist. Preservar o teste ponta a ponta que o usuário relatou.
- R09: alerta do PDF histórico implementado; não substituir a norma por um documento sem aprovação/vigência comprovadas.
- R10: fonte institucional lista currículo versão 2020 e Resolução CEPE 55/2021 aprova esse PPC; o download do link ativo apresentou timeout nesta rodada. Não declarar conferência integral do PDF ou aplicabilidade a todas as turmas.
- R11: preservar o manual atual e seus links.
- Revisão dos 108 trabalhos/pastas históricas, indicadores e Gov.br foi adiada em decisões anteriores; não transformar isso em nova edição de dados.
- Saudação abreviada ASTEN: preservar o envio do nome completo; nenhuma regra da plataforma foi alterada sem contrato confirmado.

## Fechamento local desta rodada

- Auditoria: autosave de rascunho, imagem do editor e aparência da planilha deixam de gerar novos registros críticos. Publicações efetivas, falhas, responsabilidade por correção e controles de retomada permanecem. Histórico anterior não apagado.
- Navegador: orientador fictício acessou com OTP normal; prévia do título foi aplicada, confirmada e salva. Leitura do arquivo local confirmou dataRevision 3 e título idêntico ao mostrado na lista; fase Defesa preservada. Nenhum e-mail, ata ou assinatura real gerado.
- Checks: TypeScript, build, acessibilidade estática, verificação de segredos e contrato de finalização passaram. Build mantém avisos de tamanho de chunks; não constitui falha de compilação.
- A suíte ampla não é reportada como integralmente verde: a falha de transporte e sua repetição isolada estão preservadas nos logs. Não houve mudança no servidor para fazer o teste de avaliação passar.
- Pacote de recuperação: IMPLEMENTACAO.patch contém alterações rastreadas e novas fontes desta revisão; o bundle das branches contém a recuperação das pontas remotas removidas.
- Local para continuidade: esta pasta de revisão durável, não a cópia antiga de desenvolvimento. O servidor de prévia atende em http://127.0.0.1:3000.

## Fonte Word preservada

Cópia integral e hash conferido: requisitos/Portal_TCC_Documento_de_Melhorias_v0.2.docx. Mapeamento específico dos oito requisitos: requisitos/CONFERENCIA_v0.2.md. A versão 0.2 contém R01–R08; os itens R09–R11 são de continuação posterior. Aceite visual amplo e normalização histórica em lote não foram presumidos.

## Escolha explícita da capitalização — complemento de 15/11

Cadastro inicial: título e instituições exibem sugestão e Manter como escrevi. A etapa não avança enquanto uma diferença de capitalização não for decidida; depois da confirmação, caixa alta e siglas desconhecidas são preservadas. A edição do valor exige nova decisão quando difere da sugestão. A conferência do orientador reutiliza a mesma escolha para título, examinadores e coorientador. Sem alterações em massa no histórico.

Verificado no navegador: instituição CENTRO XYZQ mantida e etapa seguinte liberada; título ESTUDO DO PROJETO XYZQ NO SUS inicialmente pediu confirmação, depois avançou e apareceu integralmente em caixa alta na conferência final. Somente rascunho fictício local; nenhum novo processo tramitado. Capturas 15–18 em output/playwright. Conta fictícia cadastro.revisao@example.invalid criada apenas na lista local para navegação.

Testes: 35/35 no grupo de regressão (servidores de teste com HMR desativado para evitar colisão de porta), 3/3 na conferência/admissão de grafia, TypeScript, build e acessibilidade estática passaram. A tentativa inicial de testes durante build/edição teve falhas e foi substituída pela rodada final registrada; logs iniciais preservados.

## Segunda rodada de economia

Implementados localmente: paginação do histórico crítico no banco para navegação padrão, com revisão e papéis conferidos; revalidação privada de PDFs públicos por hash. Medição, testes, configuração exigida e limites em ECONOMIA_RECURSOS_2026-11-15.md. Buscas/filtros/exportações e certas gravações continuam amplos; não marcar economia total como encerrada nem publicar sem aprovação.

### Pedido adicional — Ver/Baixar diretamente no Drive

- [x] Resolução nominal segura e sem transferência do PDF nos cartões de documentos administrativos (local).
- [x] Preservar alternativa pelo Portal quando o participante ainda não tem acesso nominal no Google.
- [ ] Homologar acesso com contas Google reais e arquivos arquivados.
- [ ] Estender aos comprovantes, arquivos acadêmicos e legados.
- [ ] Preparar publicação/revogação direta de arquivos autorizados do repositório público, preservando os originais privados.
- [ ] Aprovação do usuário e publicação; permanecem suspensas.

### Separação dos momentos de Conceito e Ata

- [x] Aviso compacto de espera sem orientação de correção antes da liberação.
- [x] Correção disponível ao orientador somente com o registro da ata liberado; API valida a mesma condição.
- [x] Aviso vermelho separado com link do Portal do Professor, somente na etapa liberada.
- [x] Dois exemplos demonstrativos conferidos no navegador; nenhuma ata registrada e nenhum envio real.
- [x] Guia e PDF esclarecem a disponibilidade por etapa.

### Normas atualizadas e examinadores sem tratamento docente

- [x] Referência local substituída pelo PDF indicado no Drive (capa de 2019).
- [x] Leitura pública por link autorizada pelo usuário, aplicada somente ao PDF e confirmada com download sem autenticação.
- [x] Tratamento docente opcional para os dois examinadores no cadastro inicial e na conferência.
- [x] Campos publicados antigos não tornam esse tratamento obrigatório novamente.
- [x] Validação e gravação HTTP preservam a escolha vazia; nomes documentais não ganham Professor automaticamente.
- [x] Verificação TypeScript e testes específicos; seleção conferida no navegador.
- [ ] Publicação do código permanece suspensa.
