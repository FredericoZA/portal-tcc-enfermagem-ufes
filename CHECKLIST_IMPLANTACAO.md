# Implantação e primeiro dia de uso — RC10

O código está preparado para implantação. O uso real depende de conectar as contas e concluir o piloto abaixo. Consulte `docs/RELATORIO_VALIDACAO_RC10.md` para as evidências desta entrega. A RC10 não foi publicada nas contas institucionais.

Para o destino informado pelo responsável, consulte `IMPLANTACAO_UFES.md`. O perfil `.env.ufes.example` já contém `tccenfermagemufes@gmail.com` como primeiro Master.

## 1. Abrir o sistema no computador

Instale Node.js 22.23.2 ou outra versão compatível da linha 22 e npm 11. Extraia o ZIP e abra um terminal na pasta que contém `package.json`.

```bash
npm ci
```

No Windows PowerShell:

```powershell
Copy-Item .env.development.example .env.local
npm run dev
```

No macOS ou Linux:

```bash
cp .env.development.example .env.local
npm run dev
```

Abra `http://localhost:3000`. Este perfil permite conhecer as telas com dados fictícios. Para encerrar, pressione Ctrl+C no terminal. A demonstração não comprova envio de e-mail, assinatura ou arquivamento real.

## 2. Reunir os itens da instalação

| Item | Onde será usado |
|---|---|
| Projeto Vercel exclusivo e endereço do portal | Hospedagem, callbacks e primeiro acesso |
| Projeto Supabase exclusivo | Estado, acesso, auditoria e transporte temporário privado |
| E-mail do Master e do Presidente | Bootstrap e administração; assinatura das declarações |
| E-mail do departamento e locais autorizados | Solicitação de reserva de sala |
| OAuth Google do responsável | Drive, Docs, Gmail e Calendar |
| Token, endpoint e callback da Asten | Assinaturas da ata, termo e declaração |
| Quatro DOCX oficiais com `<<VARIAVEIS>>` | Convite, ata, termo de autorização e declaração/certificado |

Os segredos são cadastrados no ambiente e no painel de integrações, conforme `.env.example`. Não envie senhas no chat e não coloque chaves em arquivos públicos. Os modelos oficiais e as credenciais não acompanham o ZIP.

Foram consultadas as conexões disponíveis de Supabase e Vercel nesta revisão. Não foi identificado vínculo inequívoco de uma instalação existente com este pacote. Não reutilize um projeto de outro sistema somente porque ele já está conectado.

## 3. Instalar no ambiente definitivo

1. Siga `IMPLANTACAO_PRODUCAO.md`. Havendo instalação anterior, faça o backup previsto em `docs/ATUALIZACAO_E_ROLLBACK.md`.
2. Aplique todas as seis migrações de `supabase/migrations`, na ordem dos nomes. A última é `202609060001_asten_transactional_outbox_v6.sql`. A RC10 não acrescenta migração SQL.
3. Configure o projeto Vercel para Node.js 22 usando `vercel.json`. Preencha as variáveis de `.env.example`; não copie o perfil de demonstração.
4. Complete o bootstrap do Master seguindo `docs/PRIMEIRO_ACESSO.md`. Conecte Google e Asten pelo painel do portal. Confirme o callback da Asten e o cron autenticado.
5. Cadastre os endereços institucionais e os quatro DOCX. Valide os marcadores, publique os formulários e o fluxo, publique a aparência global.
6. Execute `npm run test:ci` e `npm run test:secure-flow` no código implantado. Registre a versão, URL e resultados.

## 4. Concluir o piloto antes de abrir aos alunos

Use pessoas e endereços de teste autorizados. Execute um processo individual e outro em dupla. O roteiro detalhado está em `docs/HOMOLOGACAO_RC10.md`.

O piloto precisa comprovar: pedido de reserva recebido; declaração do aluno; convite correto; conferência e nota pelo orientador; ata assinada na Asten e arquivada no Drive; entrega final; termo com os signatários corretos quando houver publicação; declaração assinada pelo Presidente; publicação somente ao final. Teste também uma falha e sua retomada.

Confira computador e celular, teclado, foco dos pop-ups e fidelidade dos PDFs aos DOCX. Reinicie a aplicação e confirme que os registros permanecem no banco. A fila de pendências deve explicar qualquer etapa incompleta.

## 5. Liberação e acompanhamento

Libere os primeiros alunos depois de registrar evidências aprovadas do piloto. No primeiro dia, acompanhe as filas de e-mails, documentos e assinaturas. Se aparecer “salvo com pendência”, retome pela fila administrativa; não cadastre outro TCC nem crie outro envelope sem conferir o estado existente.

Entregue ao operador a URL, o e-mail do Master, a versão implantada e o local do backup. A homologação real continua **não confirmado** até que as evidências sejam produzidas. Recursos novos podem ser avaliados após a entrada em operação.

Para continuar com outra IA, anexe o ZIP completo e peça: “Execute PROMPT_PARA_IA.md e CHECKLIST_IMPLANTACAO.md sobre este código, preservando o fluxo e registrando as evidências de implantação.”
