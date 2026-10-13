# Portal TCC 16 — transição para desenvolvimento local

Atualizado em 13/10/2026. Este documento descreve o estado verificado e como prosseguir sem builds desnecessários na Vercel.

## Versão e serviços

- Repositório: https://github.com/FredericoZA/portal-tcc-enfermagem-ufes ; branch oficial `main`.
- Produção: https://portal-tcc-enfermagem-ufes.vercel.app/ ; equipe Vercel `tcc-enfermagem`; projeto `portal-tcc-enfermagem-ufes`.
- Referência de auditoria anterior ao fechamento: commit `0cb8c8a20853b116c64da84f49dbb02036a7c262`, deployment `dpl_BriE86LdNPbstHqdWzUoznPLvPYE`, estado `READY`. Se o código avançar, confira o novo SHA e o deployment correspondente; `READY` não equivale a teste funcional ponta a ponta.
- Supabase: projeto `vvgdmycmotazqjvpywmk` na região `sa-east-1`, `ACTIVE_HEALTHY` na auditoria. 16 migrações aplicadas, incluindo a outbox Asten v6; não executar novamente as migrações sobre produção. Avisos do consultor de segurança: zero na consulta de 13/10. Nunca presumir equivalência entre modo local e banco real.
- Asten: envios oficiais bloqueados. PR #158 para escolha de repositório ainda em Draft, com um alerta CodeQL HIGH pendente. NÃO fazer merge nem ativar assinaturas antes de análise da vulnerabilidade e piloto controlado com documentos fictícios.

## Executar no Windows (modo isolado)

1. Instalar **Git**, **Node.js 22.x** (não 24) e **npm 11.9.0**. Verificar `git --version`, `node --version` e `npm --version` em um PowerShell novo.
2. Clonar o repositório oficial (não uma branch histórica ou projeto Vercel novo):

```powershell
git clone https://github.com/FredericoZA/portal-tcc-enfermagem-ufes.git
cd portal-tcc-enfermagem-ufes
git switch main
git pull --ff-only
npm install --global npm@11.9.0
npm run local
```

3. Abrir http://localhost:3000 . A preparação cria `.env.local` a partir de `.env.development.example`, gera segredos **somente locais**, instala dependências se faltar e compila o cliente.
4. Não versionar `.env.local` nem copiar variáveis `SUPABASE_SECRET_KEY`, Google OAuth, token Asten, segredos da Vercel ou dados pessoais para esse modo. O preparador bloqueia configuração explícita de provedores reais. A demonstração local não altera a produção.
5. Para editar com recarregamento rápido, interromper o servidor e executar `npm run dev` **após** a preparação. Salvar mudanças numa branch dedicada.

## Rotina de desenvolvimento sem gastar builds Vercel

```powershell
git switch -c work/minha-alteracao-local
npm run lint
npm run test:unit
npm run test:ci
npm run test:secure-flow
npm run build
git status --short
```

- Somente aprovar e integrar PR quando CI, CodeQL, contratos e QA visual aplicáveis estiverem verdes; commits locais não publicam o site.
- `vercel.json` mantém `git.deploymentEnabled: false` inclusive para `main` e previews. Publicar apenas com autorização, em lote único, após congelar o SHA e validar backup e regressões.
- Os dois workflows `production-smoke` e `production-security-headers` passaram a ser **manuais**; ao executá-los, informar o SHA **da versão realmente publicada** na Vercel. A CI principal continua rodando no GitHub normalmente.
- Para conferir diferença entre computador e produção: `npm run parity:check`. Divergência é esperada depois de alterações locais ainda não publicadas.
- `npm run release:zip` gera pacote de código sem `.env.local`, segredos, `node_modules`, cache ou `.git`; não é backup do banco nem do Google Drive.

## Dados e serviços externos

- Modo local padrão: dados e autenticação simulados. Não usar dados de estudantes reais nem enviar convites ou assinaturas.
- Para **teste integrado** com Supabase/Google/Asten, provisionar projetos, OAuth, segredos e dados fictícios *separados* da produção, com permissões mínimas, URL de callback específica e política de retenção. Isso é trabalho próprio, não basta importar `.env` de produção.
- Supabase de produção continua fonte de verdade do runtime; Drive privado armazena arquivos institucionais. Não limpar/resetar banco, tokens, Drive ou buckets para 'sincronizar' o local.
- Os crons da Vercel continuam programados; desligar deployments automáticos não interrompe automaticamente os cron jobs da versão já publicada.

## Pendências conhecidas que NÃO devem ser liberadas por conveniência

1. **PR #158:** um alerta CodeQL HIGH ainda demanda leitura da anotação e correção fundamentada; conexão Asten e escolha de repositório dependem desse código não publicado.
2. **Asten real:** falta homologação de credenciais, assinatura, webhook, PDF, outbox e arquivo no Drive; regras de pastas por documento ainda não são implementadas.
3. **CSS e arquitetura:** ainda existem overrides tipográficos em componentes e arquivos grandes, como `server.ts`; decompor por domínio, com testes, sem reescrever o sistema.
4. **Outros PRs:** Dependabot e branches históricas não são lançamentos aprovados; não mesclar todos sem verificação de breaking changes, compatibilidade e segurança.
5. **Backups e rollback:** verificar rotinas institucionais, retenção, credenciais e restauração real antes de mudanças de dados em qualquer ambiente integrado.

## Links de acompanhamento

- Asten: https://github.com/FredericoZA/portal-tcc-enfermagem-ufes/issues/155
- Segurança/CodeQL: https://github.com/FredericoZA/portal-tcc-enfermagem-ufes/pull/158
- Arquitetura/CSS: https://github.com/FredericoZA/portal-tcc-enfermagem-ufes/issues/156
- Controle de publicação: https://github.com/FredericoZA/portal-tcc-enfermagem-ufes/issues/152

Em uma nova sessão ou ferramenta local, começar pela leitura deste documento, `README.md`, `docs/CONTROLE_DE_PUBLICACAO_E_BRANCHES.md`, questões #152/#155/#156 e estado exato de `git status` e `git log -1`.
