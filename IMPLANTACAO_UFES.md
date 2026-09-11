# Implantação — TCC Enfermagem UFES

Estado conferido em 11/09/2026. Código RC10 com correções de implantação adicionais.

## Destinos

- Master: `tccenfermagemufes@gmail.com`. O primeiro OAuth Google do portal deve usar essa conta.
- Repositório privado independente: https://github.com/Compilandog/portal-tcc-enfermagem-ufes . Os arquivos ficam na raiz, em projeto paralelo ao repositório Codex.
- Vercel pretendida: conta `tccenfermagemufes@gmail.com`, usuário `tccenfermagem`, equipe exibida `tcc-enfermagem`, conforme imagem atual enviada pelo responsável. O conector atual retorna lista vazia de equipes e não consegue listar os projetos desse destino; implantação não confirmada. Há um registro histórico de projeto `prj_PFgvQTDoiSkTd4q0kHibinl4IiKg` na equipe `team_2k7P46rFwN1CxQvPhwg9ifXp`; não reutilizar automaticamente esses IDs, pois diferem da identificação atual. Confirmar o ID da equipe e listar seus projetos após autenticação antes de criar ou vincular o destino.
- URL reservada: https://portal-tcc-enfermagem-ufes.vercel.app . Ainda não é evidência de site publicado.
- Supabase: organização TCC Enfermagem UFES (`hrgikcarrxuoitwjexxp`), projeto ativo `vvgdmycmotazqjvpywmk`, região São Paulo. URL https://vvgdmycmotazqjvpywmk.supabase.co .
- Drive: pasta Portal de TCC, https://drive.google.com/drive/folders/1zkG3fBm2tJESZjZP0_7jStUuPNXCwRPS . Proprietário confirmado: `tccenfermagemufes@gmail.com`; acesso compartilhado de edição: `compilandooconhecimento@gmail.com`.

## Configuração e pendências

1. Usar o Supabase existente acima. Na Vercel, autenticar a conta atual, identificar a equipe tcc-enfermagem e listar os projetos. O responsável informou que ainda não há projeto instalado nessa equipe: se estiver vazia, criar o projeto do portal nela; se já existir, reutilizá-lo após conferir sua identidade. Não sobrescrever projetos de terceiros.
2. Conectar o repositório independente à Vercel. Root Directory deve ser a raiz (`.`), não `portal-tcc`. Node.js 22, região `gru1`, instalação `npm ci --include=dev`, build `npm run build`, saída `dist/client`.
3. Preservar os segredos já cadastrados na Vercel. `SUPABASE_URL` foi cadastrada; a chave privada do servidor (`SUPABASE_SECRET_KEY` ou a alternativa legada aceita pelo código) ainda precisa ser configurada. Nunca usar prefixo VITE_ para segredos.
4. Usar `.env.ufes.example` como referência pública. Cadastrar `PORTAL_DRIVE_ROOT_FOLDER_ID=1zkG3fBm2tJESZjZP0_7jStUuPNXCwRPS` na produção. A integração reutiliza essa pasta e interrompe a operação se não tiver acesso, se a pasta não permitir escrita ou se tiver compartilhamento amplo. Ela não cria outra raiz como alternativa.
5. Configurar cliente OAuth Google, com `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET` e callback `https://portal-tcc-enfermagem-ufes.vercel.app/api/integrations/google/oauth/callback`. Autorizar o aplicativo com a conta Master institucional. O compartilhamento da pasta e a conexão do Drive nesta conversa não substituem essa autorização. O token do aplicativo precisa ter acesso à pasta existente dentro dos escopos concedidos. O escopo drive.file não concede automaticamente ao novo aplicativo todas as pastas acessíveis à conta; poderá ser necessário autorizar a seleção pelo Google Picker. Essa seleção ainda não foi implementada. Validar e resolver esse acesso no piloto antes de emitir documentos. A propriedade dos novos arquivos depende da conta OAuth que os criar.
6. Concluir `docs/PRIMEIRO_ACESSO.md`, cadastrar os DOCX oficiais e Asten, conferir e-mail do departamento e Presidente e executar `docs/HOMOLOGACAO_RC10.md` com destinatários de teste autorizados. Não deduzir esses dados a partir do e-mail do Master.

## Banco e validações desta implantação

O Supabase possui 23 tabelas com RLS e bucket `portal-secure-transfer` privado. Foram aplicadas oito migrações. Duas correções adicionais resolvem o caminho de busca do pgcrypto nas funções e o gatilho de acesso dos autores, que falhava ao referenciar um campo inexistente.

As seis migrações iniciais receberam versões remotas geradas pelo conector, diferentes dos prefixos dos arquivos locais:

| Arquivo local | Versão remota |
| --- | --- |
| 202608270001_portal_producao.sql | 20260911003735 |
| 202608290001_portal_normalized_core.sql | 20260911003748 |
| 202608310001_portal_transactional_runtime.sql | 20260911003802 |
| 202609010001_portal_governance_v4.sql | 20260911003814 |
| 202609040001_portal_secure_file_transport_v5.sql | 20260911003827 |
| 202609060001_asten_transactional_outbox_v6.sql | 20260911003841 |

As duas correções têm os mesmos prefixos local e remoto: `20260911102103` e `20260911102237`. Conferir o histórico antes de qualquer db push; não reaplicar migrações cegamente.

Verificado nesta revisão:

- Teste SQL real `supabase/tests/portal_smoke.sql`: gravação transacional, acesso dos autores, conflito de revisão, auditoria somente de acréscimo e idempotência do envio Asten. Executado em transação com rollback; usuários, processos e estado de execução permaneceram vazios.
- Nenhuma permissão pública encontrada nas tabelas/funções verificadas. Auditor de segurança sem alertas WARN/ERROR; os avisos INFO de RLS sem políticas correspondem ao acesso exclusivo do servidor.
- 15 testes das integrações Google passaram, incluindo quatro testes da raiz escolhida.
- Validação local inicial: `npm run lint` e `npm run build` passaram no Node.js 24.
- Validação posterior do commit `12916599632ba8fff1209297cc475c33adbb1a0a` no GitHub Actions, Node.js **22.23.2**: **99 testes unitários, 38 verificações do fluxo**, compilação, tipagem, verificação estática de acessibilidade em 123 arquivos e teste HTTP aprovados. A etapa de contratos também passou (9 testes já incluídos na suíte unitária; não somar como testes únicos). Evidência: https://github.com/Compilandog/portal-tcc-enfermagem-ufes/actions/runs/34595986811 .

O relatório histórico RC10 está em `docs/RELATORIO_VALIDACAO_RC10.md`. Integrações reais Google/Asten, conexão servidor-Supabase na Vercel, inspeção visual e piloto integral ainda não foram confirmados. Senhas, tokens e chaves privadas não devem ser gravados no repositório nem enviados no chat.
