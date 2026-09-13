# Implantação e primeiro dia de uso — Portal TCC

O Portal já possui projeto de produção e o código é validado por CI e smoke test de produção a cada rodada publicada. Isso não substitui a homologação operacional com as contas institucionais: a abertura para alunos depende de todas as integrações críticas estarem ativas e de um piloto real aprovado.

Para o destino institucional, consulte `IMPLANTACAO_UFES.md`. O bootstrap, a configuração e os segredos devem seguir os arquivos de ambiente de exemplo e nunca ser enviados por chat ou gravados no repositório.

## 1. Preparar uma cópia local quando necessário

Use Node.js 22 e npm compatível com o `packageManager` definido em `package.json`.

```bash
npm ci
```

Para desenvolvimento no macOS ou Linux:

```bash
cp .env.development.example .env.local
npm run dev
```

No Windows PowerShell:

```powershell
Copy-Item .env.development.example .env.local
npm run dev
```

A demonstração local serve para conhecer telas e validar código. Ela não comprova envio institucional de e-mail, assinatura Asten, permissões reais do Drive nem persistência de produção.

## 2. Itens obrigatórios da instalação

| Item | Uso |
|---|---|
| Projeto Vercel exclusivo e URL oficial | Hospedagem, callbacks e acesso ao Portal |
| Projeto Supabase exclusivo | Persistência, auditoria e transporte privado |
| E-mail do Master e da Presidente | Administração e papel institucional da Presidência |
| E-mails de recuperação do Master | Recuperação administrativa segura |
| E-mail do departamento e locais autorizados | Fluxo de reserva/defesa |
| OAuth Google institucional | Drive, Docs, Gmail e Calendar |
| Token e callback Asten | Assinaturas da ata, termo e declaração |
| Quatro DOCX oficiais com `<<VARIAVEIS>>` | Convite, ata, termo de autorização e declaração |
| Símbolo oficial do curso | PNG transparente 1024 × 1024 px, até 1 MB |

Segredos ficam somente no ambiente seguro ou no painel específico de integrações. Não coloque token Asten, senha, chave privada ou segredo OAuth em código, documento público, issue ou conversa.

## 3. Atualizar o ambiente definitivo

1. Siga `IMPLANTACAO_PRODUCAO.md`. Antes de mudança estrutural, preserve o rollback descrito em `docs/ATUALIZACAO_E_ROLLBACK.md`.
2. Aplique **todas** as migrações existentes em `supabase/migrations`, em ordem cronológica pelo nome. Não use contagem fixa: novas migrações podem ser adicionadas. Na revisão atual, a sequência termina em `20260911190000_portal_publication_integrity_v9.sql`.
3. Use Node.js 22 na Vercel e mantenha as variáveis compatíveis com `.env.example`.
4. Complete o bootstrap do Master conforme `docs/PRIMEIRO_ACESSO.md`.
5. Conecte Google Workspace e Asten pelo Portal. Confirme pasta raiz privada, callback da Asten e persistência Supabase.
6. Cadastre os quatro DOCX oficiais, valide variáveis e prévias e publique somente configurações revisadas.
7. Execute a homologação assistida do Portal e resolva todos os itens reprovados antes do piloto.
8. A CI deve aprovar `npm audit`, `npm run test:ci`, importação do servidor, `npm run test:secure-flow` e o contrato institucional.
9. Depois do merge em `main`, confirme o Production smoke no mesmo commit implantado.

## 4. Piloto real obrigatório

Use pessoas e endereços de teste autorizados. Execute pelo menos um processo individual e um em dupla. O roteiro vigente está em `docs/HOMOLOGACAO_ATUAL.md`; arquivos `HOMOLOGACAO_RC*.md` são históricos.

O piloto deve comprovar, ponta a ponta:

- autorização e acesso do aluno;
- cadastro e, quando aplicável, aceite da coautoria;
- confirmação do local e continuidade correta do fluxo;
- convite institucional e evento de calendário;
- revisão dos dados pelo orientador;
- registro de **resultado e parecer** da avaliação, sem nota numérica;
- geração da Ata pelo DOCX oficial, assinatura Asten e arquivamento no Drive;
- entrega final e tratamento correto de substituição de arquivos;
- termo de autorização com signatários corretos quando houver publicação;
- declaração da banca conferida e assinada pela Presidente;
- publicação apenas dos arquivos autorizados, mantendo originais e pastas privados;
- retirada de publicação sem perder o arquivo privado;
- retomada segura após pelo menos uma falha simulada;
- permanência dos registros após reinício/novo acesso.

Confira também computador e celular, navegação por teclado, foco dos diálogos, mensagens de erro, QR Code, rodapé público e fidelidade dos PDFs aos DOCX.

## 5. Critério para abertura aos alunos

O Portal só deve ser liberado quando simultaneamente:

- Supabase e runtime transacional estiverem saudáveis;
- Google Workspace e a pasta raiz privada estiverem válidos;
- Asten e callback estiverem conectados;
- quatro modelos oficiais estiverem configurados;
- CI e Production smoke do commit publicado estiverem aprovados;
- piloto real tiver evidência registrada e nenhuma pendência crítica aberta.

A existência do site em produção **não** equivale à homologação do fluxo acadêmico. Enquanto o token Asten ou o piloto real não forem confirmados, a homologação ponta a ponta permanece **não confirmada**.

## 6. Operação contínua

Após a abertura, acompanhe `Indicadores`, inclusive o Monitor operacional, falhas de e-mail, formulários no Drive e eventos Asten. Utilize as rotinas de saúde, integridade e backup das Configurações para diagnóstico e recuperação.

Se aparecer uma pendência, retome a operação existente antes de criar outro TCC, outro documento ou outro envelope. Auditoria e idempotência devem ser preservadas.
