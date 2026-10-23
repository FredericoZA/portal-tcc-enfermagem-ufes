# Portal Institucional de TCC

Software aberto para centralizar o ciclo de Trabalho de Conclusão de Curso de uma unidade acadêmica: autorização de acesso, cadastro, banca, agenda, avaliação, documentos, assinatura Asten, arquivo privado no Google Drive e repositório público.

Esta implantação atende **somente o Curso de Enfermagem**. Identidade, regras, modelos DOCX, e-mails, formulários, fluxo e aparência são publicados pelo usuário Master em **Configurações**. O código aberto e o guia do GitHub permitem que outra secretaria crie uma instalação independente, sem transformar este portal em um sistema multicurso.

A versão de execução é definida em `package.json`. Não use documentação histórica para inferir qual build está em produção; compare sempre os commits com `npm run parity:check`.

Desde a **RC9**, o formulário do orientador está integrado à tela e à API: a conferência explícita dos dados, a nota válida e a revisão atual são obrigatórias. A ata continua sendo preenchida pelo DOCX do Master. Tabelas e pop-ups compartilham aparência publicada; mensagens e confirmações usam o diálogo do portal. O aluno continua registrando a confirmação recebida do departamento, sem depender de acesso do departamento ao portal.

**Comece por [CHECKLIST_IMPLANTACAO.md](./CHECKLIST_IMPLANTACAO.md)**. A visão geral está em [COMECE_AQUI.md](./COMECE_AQUI.md). Para outra IA, entregue [PROMPT_PARA_IA.md](./PROMPT_PARA_IA.md). O fluxo vigente está em [FLUXO_OPERACIONAL_RC9.md](./docs/FLUXO_OPERACIONAL_RC9.md), com [resultados dos testes](./docs/RELATORIO_VALIDACAO_RC10.md) e [homologação pendente](./docs/HOMOLOGACAO_RC10.md). Os documentos RC5 a RC8 registram rodadas anteriores.

O estado da assinatura, da organização por pastas e do piloto separado em 15/10/2026 está em [Consolidação Asten](./docs/CONSOLIDACAO_ASTEN_2026-10-15.md). O [roteiro de configuração Asten](./docs/ASTEN_CONFIGURACAO_SEGURA_PASSO_A_PASSO.md) descreve a conexão e os controles de envio. As evidências desse piloto não comprovam publicação dessas alterações no GitHub ou na instalação principal.

## Regras centrais

- Master e Presidente da Comissão são os únicos administradores globais.
- O login usa código de uso único enviado por e-mail, sem senha local.
- O Master ou Presidente pré-autoriza os alunos. Ao salvar o primeiro formulário, os e-mails válidos dos autores, orientador, coorientador e banca passam a ter acesso ao processo.
- Cada aluno pode criar somente um TCC de graduação, mas pode participar sem limite como orientador, coorientador ou examinador em outros processos.
- Calendário, tutorial e repositório público dispensam login. Dados privados, arquivos e downloads usam autorização por processo.
- Nenhum modelo documental operacional está incluído. O Master ou o Presidente envia os quatro DOCX em Configurações; cada versão ativa permanece no Drive da própria instalação. A importação de arquivo preexistente por link é opcional e fica desativada por padrão, pois exige o escopo Google `drive.readonly`.
- A assinatura automática pela Asten atende: ata pelo orientador; termo pelos autores e orientador simultaneamente, todos na prioridade 1; declaração pelo Presidente; convite sem assinatura. O perfil `EMAIL_LINK` envia o convite sem exigir conta Asten, SMS ou celular. O Portal confirma essas assinaturas na API e arquiva os bytes originais no Drive privado. Para declarações, Master e Presidente também podem preparar o PDF, assiná-lo no Gov.br, devolver o arquivo e registrar a conferência manual no VALIDAR/ITI. A aprovação exige o hash exato, a revisão atual e confirmação do titular e do conteúdo; o envio isolado permanece pendente. Consulte [Assinatura Gov.br e conferência manual](./docs/ASSINATURA_GOVBR_CONFERENCIA_MANUAL.md).
- Os destinatários vêm dos cadastros persistidos. O Master escolhe três pastas diferentes no repositório Asten, uma para cada tipo de documento. O Portal valida a conta e o repositório de cada destino e fixa o destino no job antes de criar o envelope; alterar a configuração vale para os próximos envelopes.
- O retorno HTTPS da Asten é registrado na fila privada `portal_asten_webhook_inbox` e processado em segundo plano na Vercel, com reconciliação diária de contingência. A migração `202610140001_asten_webhook_inbox.sql` é necessária antes de publicar esse fluxo com Supabase.
- O termo existe somente quando há pedido expresso de publicação.
- Google Drive é o arquivo definitivo dos modelos, formulários, trabalhos, documentos gerados e assinados. Supabase guarda o estado operacional, permissões, auditoria, projeções e o staging privado e temporário usado para evitar transportar arquivos grandes pela função Vercel.
- O cadastro inicial é o único formulário nativo. Confirmação do local, avaliação/ata e entrega final são preenchidas diretamente nas abas do processo; seus campos e registros históricos são preservados.
- Formulários personalizados criados no Estúdio aparecem automaticamente no processo apenas para o papel definido, preservam a revisão usada, geram PDF no Drive e podem disparar eventos `FORM_<ID>_SUBMITTED`.
- Área temática, tema principal, tipo de estudo e finalidade podem ser coletados por campos canônicos configuráveis. Os relatórios não inferem esses dados do título ou do resumo.
- Os dois arquivos vivos são recalculados diariamente e sob demanda, permanecem privados no Drive e não incluem nomes, e-mails, matrículas, títulos ou resumos.
- O relatório institucional usa dados agregados, filtros de período, comparação, gráficos vetoriais e metodologia explícita; grupos pequenos continuam protegidos.

> **Migração local (Portal TCC 16):** consulte [Guia de continuidade local e estado das plataformas](./docs/TRANSICAO_LOCAL_PORTAL_TCC16_2026-10-13.md). O modo padrão é isolado; nunca copie segredos da Vercel nem uma base de produção para o computador.

## Executar localmente

Para o ambiente já preparado neste Mac, consulte [Desenvolvimento local](./DESENVOLVIMENTO_LOCAL.md). O atalho `Iniciar Portal TCC.command` abre o portal e mantém o servidor ativo enquanto a janela estiver aberta.

Requisitos: Node.js 22 e npm 11.

```bash
npm run local
```

O portal inicia em `http://localhost:3000`. O comando `npm run local` prepara automaticamente o workspace: cria `.env.local` a partir do exemplo seguro caso ele ainda não exista e instala dependências quando necessário. A interface atualiza ao salvar e a API reinicia automaticamente quando seu código muda, mantendo autenticação e dados de demonstração locais. Para conferir a interface compilada antes de publicar, use `npm run local:compiled`. Nenhum desses comandos faz deploy.

Para desenvolvimento rápido com HMR, depois da preparação use `npm run dev`. Antes de comparar qualquer tela local com a Vercel, execute `npm run parity:check` e confirme que os commits coincidem.

O arquivo de desenvolvimento habilita apenas dados e autenticação simulados locais; nunca o envie à Vercel. Para produção, use `.env.example` como checklist de variáveis do painel da Vercel. Produção bloqueia inicialização sem Master de bootstrap, segredos fortes e runtime Supabase v6. Uploads de DOCX e PDF usam URL assinada de curta duração para um bucket Supabase privado; depois da validação de tamanho, MIME e SHA-256, o arquivo é enviado ao Drive e removido do staging.

## Verificar

```bash
npm run test:ci
npm run test:secure-flow
npm run test:http
npm audit --omit=dev --audit-level=high
```

`test:ci` valida TypeScript, contratos dos provedores, regras do fluxo e build. O fluxo seguro realiza verificações locais sem usar credenciais reais; `test:http` confere o servidor compilado e a separação entre cliente e API. Esses comandos não comprovam envio pelo Gmail, fidelidade de exportação no Google Docs, assinatura real na Asten, persistência em um Supabase remoto, limites da Vercel nem aparência renderizada em diferentes dispositivos.

## Implantar

Siga, nesta ordem:

1. [Primeiro acesso](./docs/PRIMEIRO_ACESSO.md)
2. [Implantação de produção](./IMPLANTACAO_PRODUCAO.md)
3. [Configuração da instalação](./docs/CONFIGURACAO_POR_CURSO.md)
4. [Modelos e variáveis](./MODELOS_E_VARIAVEIS.md)
5. [Referências do curso](./docs/REFERENCIAS_DO_CURSO.md)
6. [Testes de homologação](./docs/TESTES_HOMOLOGACAO.md)
7. [Atualização e rollback](./docs/ATUALIZACAO_E_ROLLBACK.md)
8. [Fluxo operacional RC9](./docs/FLUXO_OPERACIONAL_RC9.md)
9. [Guia de entrega ao Codex de implantação](./docs/ENTREGA_AO_CODEX.md)
10. [Inteligência contínua e estatísticas](./docs/INTELIGENCIA_CONTINUA.md)

As integrações externas só podem ser consideradas homologadas depois de um piloto no ambiente do proprietário das credenciais. A instalação deve usar projetos e credenciais próprios, diferentes entre desenvolvimento e produção. Nunca publique ou envie chaves Supabase, OAuth Google, token Asten, segredos de sessão ou webhook.

## Contribuir

Leia [CONTRIBUTING.md](./CONTRIBUTING.md) e [SECURITY.md](./SECURITY.md). O projeto é distribuído sob licença MIT.

### Proteção de capacidade do transporte temporário

As migrações `20261022025423_bound_upload_allocations.sql` e
`20261022030312_bound_download_allocations.sql` limitam atomicamente os objetos e
bytes temporários antes da emissão de uploads ou da criação de downloads. Devem
acompanhar o código do transporte. O bucket precisa ser privado e impor no máximo
110 MiB por objeto. Reservas de upload são mantidas por 135 minutos, cobrindo a
validade de duas horas das URLs do provedor; o prazo de uso dentro do Portal
continua sendo 15 minutos. Downloads possuem limites por solicitante e globais,
com limpeza limitada de arquivos expirados antes de uma nova reserva.

A preparação de publicação executa `scripts/check-release-dependencies.mjs`; falhas
altas ou críticas impedem a publicação. Se o serviço de avisos npm não responder,
a conferência consulta a OSV e bloqueia qualquer correspondência pendente.
