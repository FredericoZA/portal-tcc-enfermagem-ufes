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
4. Em **Configurações → Rodapé e Identidade**, confira os responsáveis e os dados institucionais da nova instalação. Ajuste as demais regras de acesso, catálogos e fluxo nas configurações correspondentes. Não reutilize a identidade ou os destinatários da origem.
5. Em **Configurações → Integrações e Plataforma**, valide Supabase v6, transporte temporário privado, outbox Asten, Vercel e Google. O Drive mantém a estrutura privada de arquivos. Confira também as tarefas de reconciliação e limpeza da implantação, autenticadas pelo `CRON_SECRET`.
6. Conecte o Asten. O token é enviado diretamente ao servidor, cifrado e nunca retorna à tela.
7. Em **Modelos e Variáveis**, envie cada DOCX, confira os marcadores e publique uma versão ativa. Um slot sem arquivo impede a geração correspondente. A importação por link é uma opção avançada desativada por padrão porque amplia o escopo Google.
8. Nas Configurações, informe os destinatários de reserva e os locais. Revise formulários, e-mails e fluxo. Gere uma amostra real de cada modelo pelo Google, confira os PDFs e os destinos privados no Drive. A análise automática do PDF não substitui sua conferência visual.
9. Importe ou cadastre os acessos autorizados. Confira que o autor usa seu próprio e-mail e que cada participante recebe somente as funções permitidas.
10. Faça o piloto integral descrito em `TESTES_HOMOLOGACAO.md`, usando também o fluxo atual de `FLUXO_ATUAL_2026-10-26.md` e o guia público de replicação. Teste reserva, conceito, assinatura explícita em Documentos administrativos, entrega e publicação opcional antes de liberar o uso.

## Critério de pronto

O portal só deve receber dados reais quando todos os indicadores de sincronização estiverem verdes, os quatro modelos estiverem ativos e o piloto controlado tiver confirmado OTP, staging privado, Drive, Gmail, Asten, webhook, acesso por processo e visibilidade pública. A análise estática e o build não substituem essa homologação.
