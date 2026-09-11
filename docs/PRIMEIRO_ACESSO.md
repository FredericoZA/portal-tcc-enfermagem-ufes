# Primeiro acesso do usuário Master

O portal não fica pronto apenas com um link. A primeira ativação é um procedimento único e deve ser concluída pelo futuro Master.

## Antes de abrir

- Projeto Supabase vazio com todas as migrações versionadas aplicadas e bucket privado de staging validado.
- Projeto Vercel conectado a este código e às variáveis de `.env.example`.
- Projeto Google Cloud com Drive, Docs, Gmail e Calendar ativados e callback OAuth exato.
- Conta Google institucional exclusiva ou oficial que será proprietária da estrutura do Drive e remetente dos e-mails.
- Token Asten válido e webhook configurado.
- Quatro modelos DOCX próprios do curso: convite, ata, termo de autorização e declaração.
- Lista inicial de alunos em CSV/XLSX ou cadastro manual.

## Sequência assistida

1. Configure `PORTAL_BOOTSTRAP_MASTER_EMAIL` na Vercel com o e-mail do primeiro Master.
2. Abra o portal e autorize a conta Google pelo botão de bootstrap. A conta precisa coincidir com o e-mail configurado.
3. Solicite o código enviado por Gmail e entre.
4. Em **Configurações → Governança**, preencha instituição, curso, siglas, unidade, campus, cidade, domínios aceitos, prefixo do protocolo e nome da pasta raiz. Publique a identidade.
5. Em **Configurações → Sincronizações**, valide Supabase v6, bucket privado de staging, outbox Asten, Vercel e Google. O Drive criará sua estrutura privada e idempotente. A Vercel também executará uma limpeza diária autenticada pelo `CRON_SECRET`.
6. Conecte o Asten. O token é enviado diretamente ao servidor, cifrado e nunca retorna à tela.
7. Em **Modelos e Variáveis**, envie cada DOCX, confira os marcadores e publique uma versão ativa. Um slot sem arquivo impede a geração correspondente. A importação por link é uma opção avançada desativada por padrão porque amplia o escopo Google.
8. Na Oficina, informe o e-mail do departamento, os locais de reserva e os catálogos. Revise o cadastro inicial, as apresentações das variáveis e o simulador. Gere a amostra real de cada modelo pelo Google, configure calendário útil e prazos, compare o rascunho com o publicado e só então publique e-mails, formulários, fluxo e identidade visual. A análise automática do PDF não substitui sua conferência visual.
9. Crie um período acadêmico e abra as inscrições.
10. Importe ou cadastre os alunos autorizados e faça o piloto integral descrito em `TESTES_HOMOLOGACAO.md`.

## Critério de pronto

O portal só deve receber dados reais quando todos os indicadores de sincronização estiverem verdes, os quatro modelos estiverem ativos e o piloto controlado tiver confirmado OTP, staging privado, Drive, Gmail, Asten, webhook, acesso por processo e visibilidade pública. A análise estática e o build não substituem essa homologação.
