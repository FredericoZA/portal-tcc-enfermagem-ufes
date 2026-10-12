# Publicação sob autorização — Portal TCC

Atualizado em 2026-10-12. Política decidida: **não publicar automaticamente ao fazer push ou merge no GitHub**.

## O que dispara uma publicação

- A `main` é a **única fonte oficial** de código em produção, mas commits na `main` não devem mais criar deployments automaticamente.
- `vercel.json` fixa `git.deploymentEnabled: false`, conforme configuração oficial da Vercel para impedir **todos os deploys automáticos por Git**. Não manter exceção `main: true`.
- Pull requests e alterações continuam exigindo CI, CodeQL e QA visual. Essas verificações ocorrem no GitHub e **não precisam de preview da Vercel**.
- Um deployment só será solicitado **quando o responsável pedir a publicação**. Primeiro consolidar mudanças, executar testes e confirmar commit SHA. Criar deployment manual da versão exata da `main`, nunca de branch histórica.
- **Atenção à ativação:** a Vercel pode precisar de uma publicação inicial para reconhecer a nova configuração. Até conferir no painel, o bloqueio automático é **não confirmado no projeto remoto**; a configuração no repositório, sozinha, não comprova o comportamento em produção.
- Se for necessário usar o Vercel CLI, executar `vercel deploy --prod` **somente após aprovação**, num checkout limpo e atualizado da `main`, vinculado ao projeto e à equipe corretos. Não executar esse comando em rotina automatizada. Um redeploy de deployment **antigo** não publica alterações novas do GitHub.

## Checklist de publicação manual (somente quando solicitada)

1. Confirmar a versão desejada, o commit da `main` e o resumo das alterações. Verificar backup/rollback.
2. CI, CodeQL, QA visual e contratos de segurança aprovados; nenhuma migração destrutiva pendente.
3. No projeto Vercel da equipe `tcc-enfermagem`, verificar **Settings → Git** e os deployments recentes. Não conectar novo projeto por engano.
4. Executar um único deployment manual da versão consolidada (via Vercel UI/API/CLI autorizado), anotando SHA e link gerado.
5. Verificar deployment **READY**, domínio principal, autenticação, permissões, planilhas, responsividade, documentos, API e logs sem expor dados pessoais.
6. Se houver regressão, usar o deployment anterior validado como rollback; nenhuma alteração no banco sem backup e migração segura.
7. Consultar **Usage/Builds** e registrar o consumo real. `rate limit` temporário, cobrança da Vercel e créditos para revisões do Codex são coisas diferentes.

## Política de desenvolvimento

- Usar branches curtas para o trabalho em curso; revisar, validar e integrar por **squash** na `main`. Nenhuma branch é uma “perna” ativa do aplicativo.
- Em 2026-10-12 havia 183 branches antigas. Elas **não geram custo enquanto paradas**, mas podem conter `vercel.json` antigo: não atualizar branches históricas sem auditoria. Bloqueio de integrações no **painel da Vercel** deve ser confirmado para evitar configurações herdadas.
- Antes de excluir qualquer branch: comparar commits exclusivos, PRs e backlinks, registrar o SHA, preservar backups/tags e confirmar que a versão útil está na `main`. Não apagar em massa nem mexer em branches de PR aberto.
- O sistema utiliza tokens e estilos organizados em módulos CSS, com uma entrada única `src/index.css`; o Vite gera o CSS da distribuição. A meta é remover **regras contraditórias e overrides**, não aglomerar milhares de linhas em um arquivo mais difícil de ler.
- Escala tipográfica padrão: **18 px** em títulos principais, **14 px** na navegação e **11 px** no restante. Exceção deliberada de 16 px durante o **foco no Safari/iOS** para impedir zoom automático; não é uma quarta escala de leitura em repouso.
- Asten continua inativa para **envios reais** até homologação, custódia de segredos, teste de callbacks e aprovação formal. Publicação do código não deve mudar `ASTEN_INTEGRATION_ENABLED`, `ASTEN_PILOT_APPROVED` ou `ASTEN_PRODUCTION_RELEASE_APPROVED` de `false`.

## Referências oficiais

- [Vercel — desligar todos os deployments automáticos](https://vercel.com/docs/project-configuration/git-configuration#turning-off-all-automatic-deployments)
- [Vercel — fluxo Git](https://vercel.com/docs/git)
- [Vercel — limites e cotas](https://vercel.com/docs/limits)
