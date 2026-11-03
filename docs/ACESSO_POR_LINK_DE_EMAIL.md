# Acesso pelo link de e-mail

O destino é mantido na URL do Portal (`tcc` e `secao`) durante o login.

- Sessão em verificação: aguardar a resposta de identidade antes de abrir os dados.
- Sem sessão: abrir o login normal, sem consultar primeiro o detalhe privado do TCC.
- Após o código: abrir o TCC e a seção indicados pelo link original.
- Sessão válida: abrir diretamente o destino, sem novo código.
- Cancelar e reabrir o login: manter o destino. Navegar deliberadamente para outra
  área continua permitindo sair do processo.
- Expiração: fechar os detalhes privados e pedir login, preservando o destino.
- Não há redirecionamento externo nem ampliação de acesso: o servidor continua
  verificando o vínculo e as permissões do usuário autenticado.

`ProcessDeepLink`, `PortalAccessRedirect`, `App` e o login da `HomePage` compartilham
esse comportamento. Uma abertura pública explícita pelo calendário permanece
independente do acesso autenticado pelo link de e-mail.

## Verificação local

O teste `scripts/test-email-link-login.mjs` usa o build local, dados temporários e
OTP real com entrega exclusivamente no log de desenvolvimento. Não acessa produção
nem envia e-mails. Exige Playwright no ambiente de verificação, como `test-visual`,
e pode receber `PORTAL_VISUAL_BROWSER_EXECUTABLE` para usar o navegador instalado.
A saída fica em `.portal-data/email-link-review`.

Casos: abertura anônima sem requisição ao detalhe privado; cancelamento e reabertura;
login por código; retorno ao TCC e à aba Documentos; atualização com sessão válida;
aba Dados do processo; expiração com preservação do destino.

Alteração local aguardando nova autorização de publicação.
