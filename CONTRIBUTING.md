# Como contribuir

1. Crie uma branch curta e uma alteração de escopo único.
2. Não inclua credenciais, `.env.local`, dados da pasta `.portal-data`, documentos reais ou cópias do Drive.
3. Preserve a regra “uma instalação, um curso”: textos institucionais devem vir de `InstallationProfile` ou do Estúdio, não de constantes do código.
4. Preserve os quatro slots documentais externos; não adicione modelos DOCX oficiais ao repositório.
5. Toda rota nova deve declarar autenticação e autorização. Downloads privados precisam validar o vínculo no processo.
6. Mudanças de banco exigem migração incremental e compatibilidade de leitura durante a atualização.
7. Rode `npm run test:ci` antes de abrir a contribuição.

Inclua na descrição: problema, comportamento esperado, risco de segurança/LGPD, testes executados e capturas sem dados pessoais quando houver mudança visual.
