# Implantação — TCC Enfermagem UFES

Estado conferido em 11/09/2026. Código RC10 com correções de implantação adicionais.

## Destinos

- Master: `tccenfermagemufes@gmail.com`. O primeiro OAuth Google do portal deve usar essa conta.
- Repositório privado independente: https://github.com/Compilandog/portal-tcc-enfermagem-ufes . Os arquivos ficam na raiz, em projeto paralelo ao repositório Codex.
- Vercel: projeto `portal-tcc-enfermagem-ufes`, ID `prj_PFgvQTDoiSkTd4q0kHibinl4IiKg`, equipe `team_2k7P46rFwN1CxQvPhwg9ifXp` (`tccenfermagemufes-9658s-projects`). Criado anteriormente na conta institucional. O acesso atual retorna 403; publicação não confirmada.
- URL reservada: https://portal-tcc-enfermagem-ufes.vercel.app . Ainda não é evidência de site publicado.
- Supabase: organização TCC Enfermagem UFES (`hrgikcarrxuoitwjexxp`), projeto ativo `vvgdmycmotazqjvpywmk`, região São Paulo. URL https://vvgdmycmotazqjvpywmk.supabase.co .
- Drive: pasta Portal de TCC, https://drive.google.com/drive/folders/1zkG3fBm2tJESZjZP0_7jStUuPNXCwRPS . Proprietário confirmado: `tccenfermagemufes@gmail.com`; acesso compartilhado de edição: `compilandooconhecimento@gmail.com`.

## Configuração e pendências

1. Usar os projetos Vercel e Supabase existentes acima. Não criar outros nem sobrescrever projetos de terceiros.
2. Conectar o repositório independente à Vercel. Root Directory deve ser a raiz (`.`), não `portal-tcc`. Node.js 22, região `gru1`, instalação `npm ci --include=dev`, build `npm run build`, saída `dist/client`.
3. Preservar os segredos já cadastrados na Vercel. `SUPABASE_URL` foi cadastrada; a chave privada do servidor (`SUPABASE_SECRET_KEY` ou a alternativa legada aceita pelo código) ainda precisa ser configurada. Nunca usar prefixo VITE_ para segredos.
4. Usar `.env.ufes.example` como referência pública. Cadastrar `PORTAL_DRIVE_ROOT_FOLDER_ID=1zkG3fBm2tJESZjZP0_7jStUuPNXCwRPS` na produção. A integração reutiliza essa pasta e interrompe a operação se não tiver acesso, se a pasta não permitir escrita ou se tiver compartilhamento amplo. Ela não cria outra raiz como alternativa.
5. Configurar cliente OAuth Google, com `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET` e callback `https://portal-tcc-enfermagem-ufes.vercel.app/api/integrations/google/oauth/callback`. Autorizar o aplicativo com a conta Master institucional. O compartilhamento da pasta e a conexão do Drive nesta conversa não substituem essa autorização. O token do aplicativo precisa ter acesso à pasta existente dentro dos escopos concedidos; validar isso no piloto antes de emitir documentos.
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
- `npm run lint` e `npm run build` passaram no Node.js 24. O destino Vercel permanece Node.js 22; esta rodada não foi executada no Node.js 22.

O relatório histórico RC10 está em `docs/RELATORIO_VALIDACAO_RC10.md`. Integrações reais Google/Asten, conexão servidor-Supabase na Vercel, inspeção visual e piloto integral ainda não foram confirmados. Senhas, tokens e chaves privadas não devem ser gravados no repositório nem enviados no chat.
