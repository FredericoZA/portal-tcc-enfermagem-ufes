# Como contribuir

1. Crie uma branch curta e uma alteração de escopo único.
2. Não inclua credenciais, `.env.local`, dados da pasta `.portal-data`, documentos reais, cópias do Drive, tokens, chaves privadas, arquivos de service account ou exports de configuração de provedores.
3. Nunca cole segredos reais em commit, mensagem de commit, pull request, issue, comentário, captura de tela, log ou artefato de CI.
4. Preserve a regra “uma instalação, um curso”: textos institucionais devem vir de `InstallationProfile` ou do Estúdio, não de constantes do código.
5. Preserve os quatro slots documentais externos; não adicione modelos DOCX oficiais ao repositório.
6. Toda rota nova deve declarar autenticação e autorização. Downloads privados precisam validar o vínculo no processo.
7. Mudanças de banco exigem migração incremental e compatibilidade de leitura durante a atualização.
8. Segredos de produção permanecem exclusivamente nas variáveis protegidas do provedor e no armazenamento cifrado previsto pelo backend. Não crie atalhos com `VITE_`, `localStorage`, arquivos JSON de credenciais ou constantes no frontend.
9. Rode `npm run test:secrets`, `npm run test:ci` e `npm run test:secure-flow` antes de abrir a contribuição.
10. Se Push Protection bloquear um envio, remova o segredo. Não use bypass para credencial real.

Inclua na descrição: problema, comportamento esperado, risco de segurança/LGPD, testes executados e capturas sem dados pessoais quando houver mudança visual.

Se uma credencial real tiver sido commitada, interrompa o trabalho normal, rotacione/revogue a credencial no provedor e siga `SECURITY.md` antes de continuar.
