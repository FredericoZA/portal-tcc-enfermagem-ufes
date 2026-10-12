# Política de branches, builds e publicação — Portal TCC

Atualizado em 2026-10-12.

## Arquitetura operacional

- **`main` é a única branch com publicação automática na Vercel**. O código publicado é um build único da `main`; as demais branches são históricos ou frentes de trabalho, não partes do sistema.
- **Branches de trabalho não criam preview automático**. Em `vercel.json`, `git.deploymentEnabled` estabelece `"**": false` e `"main": true`. Segundo a documentação oficial, a Vercel usa correspondência `minimatch`, e uma regra `true` prevalece sobre `false` quando ambas coincidem.
- Pull requests continuam exigindo **CI, CodeQL e QA visual** quando aplicáveis. Sem preview automático, usar homologação local ou deployment de preview pontual, depois de aprovação e quando a cota permitir.
- Fazer **um merge validado por entrega**. Evitar dezenas de commits de ajuste na `main`: acumular alterações e testar em branch antes de mesclar.
- **Asten não é liberada pela publicação visual ou de infraestrutura**. Manter `ASTEN_INTEGRATION_ENABLED=false`; aprovação operacional, credenciais e teste de piloto são procedimentos separados.

## Limpeza segura das branches

Em 2026-10-12 o repositório possuía **183 branches remotas**. Isso **não representa 183 deployments ativos**, e não é correto apagar branches para supostamente reduzir o consumo histórico da Vercel.

Critérios para arquivar/apagar futuramente, em operação separada e auditada:

1. Inventariar commits exclusivos em relação à `main`, PRs abertos e dependências; distinguir o que já foi incorporado por squash e o que é código realmente pendente.
2. Preservar explicitamente `main`, `backup/*`, `archive/*`, `recovery/*`, a branch de integração Asten até a homologação, e branches de PRs abertos.
3. Registrar SHA final e, quando necessário, tag de recuperação antes de exclusões.
4. Apagar apenas branches sem trabalho exclusivo, revisadas individualmente. **Não fazer exclusão em massa por prefixo.**

## Verificação após merge

1. Em **Vercel → equipe `tcc-enfermagem` → Portal TCC → Deployments**, conferir se há build `READY` para o commit SHA da `main`; registrar URL e hora.
2. Confirmar na versão pública a impressão digital do build exibida no rodapé da barra lateral.
3. Em **Usage** consultar consumo e limites reais. Limites temporários de builds são distintos de cobrança e créditos Codex.
4. Verificar login, navegação, planilhas, pop-ups e saúde da API. Se houver regressão, usar deployment anterior validado, preservando dados.
5. Não alterar tokens e credenciais por comentário ou commit.

## Referências

- [Configuração Git da Vercel](https://vercel.com/docs/project-configuration/git-configuration)
- [Deploy de branches e produção](https://vercel.com/docs/git)
- [Limites de builds e deployments](https://vercel.com/docs/limits)
