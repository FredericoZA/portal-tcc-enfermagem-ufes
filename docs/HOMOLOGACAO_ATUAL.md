# Homologação operacional vigente — Portal TCC

Este é o roteiro vigente para liberar o Portal TCC para uso institucional. Os documentos `HOMOLOGACAO_RC*.md` permanecem apenas como histórico das respectivas versões.

## Estado técnico e limites — 28/10/2026

A publicação anterior foi confirmada em 27/10/2026 às 23:34 (Brasília), deployment `dpl_9QML2t7qpwyWrQnDbu7ef3Xfqpwy`, com alias de produção. Evidências locais: `.portal-data/latest-release-inspect.log`, `.portal-data/latest-release-ci.log` e `.portal-data/latest-release-security.log`. Naquela rodada, 818 testes unitários, 17 contratos de provedores e 40 verificações de fluxo seguro passaram, além de TypeScript, acessibilidade estática, build e smoke HTTP local. São evidências daquela versão; uma publicação posterior exige novos registros.

O envio real da declaração do TCC de teste 2026-0003 foi confirmado na Asten, envelope 93108, em 27/10/2026. Envio confirmado não significa assinatura concluída ou arquivamento. Não criar outro envelope para comprovar o mesmo envio.

A exclusão definitiva de envelopes Asten permanece pendente de contrato de API confirmado. Cancelar a assinatura ou mover para a lixeira não comprova expurgo. A fila de limpeza deve permanecer pendente até a remoção efetiva; não marcar sucesso para esconder resíduos. As rotinas de Drive, Calendar, armazenamento temporário e banco exigem evidências próprias de execução real.

A homologação ponta a ponta permanece **não confirmada** até concluir os pilotos abaixo e conferir o arquivamento dos documentos realmente assinados. Testes isolados não comprovam operação dos serviços externos.

## Pré-condições

- Supabase de produção saudável e persistência durável ativa.
- Google Workspace institucional conectado.
- Pasta raiz do Drive privada, sem acesso público, por domínio ou grupo.
- Gmail e Calendar acessíveis pela conta institucional configurada.
- Asten conectada com token válido e callback funcional.
- Quatro modelos oficiais ativos e revisados.
- Master, Presidente e usuários de teste definidos.

## Piloto individual

1. Autorize um aluno de teste e confirme que o código de acesso funciona somente conforme a política vigente.
2. Cadastre um TCC individual com título, orientador, banca, data e horário.
3. Confirme que o processo permanece bloqueado enquanto o local não estiver confirmado.
4. Abra o formulário enviado ao departamento, confirme um local e valide o comprovante, a comunicação e a continuidade. Repita com negativa: o comprovante deve indicar indisponibilidade.
5. Verifique o convite gerado pelo modelo ativo, sem marcadores pendentes, o envio pelo Gmail e o evento no Calendar.
6. Entre como orientador, confira os dados e registre apenas **resultado e parecer**, sem nota numérica.
7. Confirme que a Ata é gerada com os dados revisados. Teste Asten com orientador e dois examinadores como signatários, todos na prioridade 1. Com uma ou duas assinaturas, a ata deve permanecer pendente e a entrega bloqueada. Em outro cenário, prepare pelo Gov.br: os três assinam o mesmo PDF, devolvido pelo orientador. PDFs com menos de três assinaturas são recusados. A conferência administrativa no VALIDAR/ITI deve confirmar todos os titulares antes do arquivamento. As ações ficam em Documentos administrativos. O registro do conceito não dispara assinaturas automaticamente.
8. Confirme que a entrega permanece bloqueada antes da Ata assinada/arquivada. Depois, preencha o Repositório e use Confirmar entrega final; confira o bloqueio dos campos e o botão centralizado Editar entrega, enquanto permitido.
9. Teste as escolhas de publicação do trabalho completo e do resumo expandido.
10. Quando houver conteúdo autorizado, confirme o Termo com aluno e orientador como signatários aplicáveis.
11. Na Área do Presidente, confira e envie a declaração à Asten; confirme assinatura e arquivamento.
12. Confirme a conclusão do processo e o contrato público: nenhuma matrícula, e-mail, SIAPE, identificador interno ou vínculo privado do Drive deve aparecer anonimamente.
13. Para trabalho/resumo autorizado, confirme que o link público só aparece depois da sincronização de publicação. Para conteúdo não autorizado, confirme o estado privado sem link.
14. Retire uma publicação de teste e confirme que o link público é removido sem excluir o original privado.

## Piloto em dupla

Repita o fluxo com dois autores e valide adicionalmente:

- ordem Aluno 1 e Aluno 2 preservada no texto e nos blocos individuais dos documentos;
- acesso correto de ambos os autores;
- variáveis dos dois alunos nos documentos;
- Termo com todos os signatários aplicáveis;
- ausência de duplicação de documentos ou envelopes na retomada.

## Falha e recuperação obrigatórias

Provoque, em ambiente de teste, pelo menos uma falha controlada em uma etapa externa (Gmail, Drive ou Asten) e verifique:

- a etapa fica registrada como pendente e não como concluída;
- ações já concluídas não são repetidas indevidamente;
- um envelope Asten de resultado incerto não é duplicado automaticamente;
- a Central de Andamento/recuperação oferece retomada acionável;
- após a retomada, o fluxo continua a partir do estado persistido.

## Persistência, segurança e operação

- Reinicie/reimplante e confirme a permanência dos dados do piloto.
- Valide concorrência básica no Supabase real e ausência de perda de atualização.
- Confirme headers de segurança, cookies e proteção contra autenticação de demonstração em produção.
- Verifique o cron autenticado, limpeza de staging e logs sem segredos.
- Execute as rotinas de saúde, integridade Portal × Drive e backup/restauração de ensaio.

## Exclusão Master

Em um processo fictício separado, verifique a exclusão independentemente da etapa. Confira os artefatos vinculados no Drive, eventos no Calendar, objetos temporários, histórico e referências do banco. Não remover modelos compartilhados, a pasta raiz ou arquivos de outro processo. Repita a limpeza para comprovar idempotência. Com envelopes Asten, exigir evidência de expurgo definitivo antes de encerrar a fila. Não usar processos ativos ou documentos institucionais como material descartável.

## Interface

Valide em navegador real, no mínimo, larguras de 320, 768, 1024 e 1440 px. Confira teclado, zoom, foco dos diálogos, fechamento com Escape, leitura dos avisos, tabelas, filtros, QR Code, rodapé público, símbolo do curso e ausência de imagens quebradas.

## Evidência mínima

Para cada cenário registre:

- data/hora;
- versão/commit implantado;
- papel e conta de teste utilizados;
- protocolo do TCC fictício;
- IDs ou links privados dos artefatos apenas no registro administrativo seguro;
- resultado esperado × observado;
- falhas encontradas e correções aplicadas.

## Critério de aprovação

O Portal só pode ser aberto aos alunos quando todos os itens críticos acima estiverem aprovados, a Asten real estiver validada, o piloto individual e em dupla estiverem concluídos e não houver pendência crítica aberta.


## Regra vigente da ata — 04/11/2026

Consulte `ASSINATURA_ATA_TRES_DOCENTES.md`. Atas históricas arquivadas são preservadas; solicitações pendentes com apenas um signatário não podem ser reutilizadas. O piloto deve incluir o acesso de cada examinador com seu próprio e-mail e comprovar as três assinaturas no provedor. Testes locais não substituem esse piloto real.
