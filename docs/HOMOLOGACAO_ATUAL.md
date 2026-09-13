# Homologação operacional vigente — Portal TCC

Este é o roteiro vigente para liberar o Portal TCC para uso institucional. Os documentos `HOMOLOGACAO_RC*.md` permanecem apenas como histórico das respectivas versões.

## Estado técnico já confirmado

Na revisão técnica de 13/09/2026, o código publicado foi aprovado por CI, auditoria de dependências, testes unitários/contratuais, fluxo seguro, contrato institucional, Vercel e Production smoke. Os quatro modelos ativos do Google Drive — convite, ata, termo e declaração — foram localizados, lidos e exportados para PDF com sucesso.

Essas evidências não substituem o piloto acadêmico real. A homologação ponta a ponta permanece **não confirmada** até a validação da Asten e a execução dos cenários abaixo com contas de teste autorizadas.

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
4. Confirme o local reservado e valide a continuidade do fluxo.
5. Verifique o convite gerado pelo modelo ativo, sem marcadores pendentes, o envio pelo Gmail e o evento no Calendar.
6. Entre como orientador, confira os dados e registre apenas **resultado e parecer**, sem nota numérica.
7. Confirme que a Ata é gerada com os dados revisados, enviada à Asten somente ao orientador, assinada e arquivada no Drive privado.
8. Envie a entrega final e confirme que ela permanece bloqueada antes da Ata assinada/arquivada.
9. Teste as escolhas de publicação do trabalho completo e do resumo expandido.
10. Quando houver conteúdo autorizado, confirme o Termo com aluno e orientador como signatários aplicáveis.
11. Na Área do Presidente, confira e envie a declaração à Asten; confirme assinatura e arquivamento.
12. Confirme a conclusão do processo e o contrato público: nenhuma matrícula, e-mail, SIAPE, identificador interno ou vínculo privado do Drive deve aparecer anonimamente.
13. Para trabalho/resumo autorizado, confirme que o link público só aparece depois da sincronização de publicação. Para conteúdo não autorizado, confirme o estado privado sem link.
14. Retire uma publicação de teste e confirme que o link público é removido sem excluir o original privado.

## Piloto em dupla

Repita o fluxo com dois autores e valide adicionalmente:

- convite e aceite de coautoria;
- bloqueio quando a coautoria não estiver aceita;
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
