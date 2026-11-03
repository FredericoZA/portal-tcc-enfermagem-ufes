# Portal TCC — Gate de publicação (03/11/2026)

## Estado
- Branch de alterações: `feat/ajustes-portal-20261103`.
- Prévia Vercel publicada: `dpl_23kXk1nnCQ3tNT9DE21qKUsTNJ4e` (`portal-tcc-enfermagem-ufes-f4hfrw6tl-tcc-enfermagem.vercel.app`).
- Produção preservada: `dpl_FBWFQXiG7WWuRC9BRJMJtVsCh8D7` no domínio `portal-tcc-enfermagem-ufes.vercel.app`.
- Validação da branch: TypeScript sem erros, 510/510 testes unitários e build de produção aprovados em Node 22.
- PDF de carta-convite: adaptação programada sobre a **cópia temporária** do modelo Drive; o modelo original não foi editado. Alinhamento renderizado e envio real de e-mail ainda **não confirmados**.
- Comprovante de reserva: existe uma proposta de novo módulo em `server/documents/reservationReceipt.ts`, mas a integração do gerador com os endpoints mais recentes da produção **não está confirmada**.
- A prévia não é automaticamente equivalente à última versão CLI de produção.

## Bloqueio de produção
O último deploy de produção foi enviado via CLI a partir de fonte local e não corresponde integralmente ao repositório GitHub. Na comparação de inventários de 03/11/2026, foram encontrados **228 arquivos presentes naquele pacote do Vercel e ausentes da branch de trabalho**, incluindo fontes, testes e recursos. O nome do commit informado no deploy não prova equivalência dos bytes.

NÃO promover a branch de prévia ao domínio oficial sem reconciliar os arquivos e refazer a verificação de paridade. A mudança arriscaria apagar funcionalidades, modelos ou integrações recentes.

## Próximas verificações
1. Recuperar fonte exata do pacote de produção (sem sobrescrever outros arquivos) e mesclar as alterações da branch de trabalho.
2. Revisar o gerador atual dos comprovantes e conectar o novo layout aos mesmos endpoints sem perder o tratamento de confirmação e recusa.
3. Validar PDFs reais de carta-convite e comprovantes, incluindo títulos, autores individuais, vocativos registrados, cabeçalhos, assinatura e alinhamento.
4. Conferir acesso, segurança, autorização e roteamento de e-mails; não enviar notificações de teste a pessoas reais.
5. Testar a paridade em prévia e, somente então, promover uma release consolidada a produção com rollback possível.


## Atualização 03/11/2026 — sincronização e preservação de fonte
- Atualização automática implementada na branch: revisão operacional consultada a cada 15 segundos quando a aba está visível, com checagem imediata quando o usuário volta ao portal. Para visitantes, o endpoint público retorna somente marcador opaco; para usuários autenticados, a revisão é consultada em rota protegida.
- TCC excluído ou inacessível durante visualização: a tela dos detalhes é fechada e apresenta mensagem. Falhas transitórias não são interpretadas como exclusão.
- Formulários em edição: o sistema não sobrescreve valores digitados com dados remotos; mostra conflito e impede gravações sobre revisão antiga.
- Listas de TCC, calendário, coordenação, indicadores, notificações e identidade revalidam sem recarregar a página.
- Verificação: **521/521 testes unitários, TypeScript e build aprovados** na branch (Node 22).
- Prévia isolada Vercel: `dpl_2wMRCXqzUGvZ2hY8WDNre3tjct8C`, URL `https://portal-tcc-enfermagem-ufes-j704045nm-tcc-enfermagem.vercel.app`; GET `/api/public/sync/version` confirmou HTTP 200 com marcador opaco.
- Manifesto de recuperação criado em `docs/PRODUCTION_CLI_SOURCE_MANIFEST_2026-11-02.json`: identifica os 228 arquivos presentes no deploy CLI e ausentes do GitHub, incluindo 161 críticos.
- Guard no `prebuild` de produção (`scripts/verify-production-source.mjs`) foi **testado**: bloqueia publicação enquanto os 161 arquivos críticos não forem recuperados. Build de prévia continua permitido.
- Recuperação de fonte: a consulta aos arquivos de origem pela integração Vercel trunca arquivos maiores; não é possível afirmar que os 228 arquivos foram restaurados integralmente. **Não substituir a versão oficial sem recuperar as fontes reais e testar equivalência.**
- A integração do gerador mais recente de comprovantes e a renderização PDF real continuam sem confirmação, e não devem ser encobertas por aprovação apenas dos testes da branch.
