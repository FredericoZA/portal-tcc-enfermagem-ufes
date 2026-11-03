# Declaração Asten — diagnóstico e correção local, rodada 65

## Evidências consultadas em leitura

- Produção: projeto Portal TCC, deployment da rodada 61 (`8f6b515`).
- No TCC-2026-0001, a declaração anterior está CANCELED, com envelope registrado
  e erro histórico de reconciliação “Acesso não autorizado!”. Isso não comprova
  que a credencial atual continua inválida: não houve nova consulta à Asten com
  esse token nesta rodada.
- Logs da Vercel mostram conferências em 24/10/2026 às 00:07 e 00:11 UTC e pedidos
  POST de assinatura às 00:11:20, 00:13:19 e 00:14:59 UTC. O estado persistido não
  contém uma nova solicitação de declaração após essas tentativas. A resposta HTTP
  dessas tentativas não está registrada no histórico antigo; a mensagem exata
  desta falha de preparação ainda não foi recuperada.
- Ata arquivada, entrega final presente e nenhuma publicação solicitada. O termo
  não é aplicável a esse processo. Existe modelo configurado da declaração.
- Master e presidência têm campos separados. O destinatário da declaração é
  `commissionPresidentEmail`, nunca um endereço fixo ou o e-mail do Master por
  conveniência. Credenciais e configuração operacional não foram alteradas.

## Ajustes no código local

- A conferência consulta o estado atual da integração, a fila de retorno, o acesso
  à pasta Asten da declaração, a configuração da raiz do Drive e a autorização
  Google. Todas essas verificações são de leitura, sem gerar PDF ou envelope.
- O botão depende da conferência atual do servidor; o estado antigo da conexão
  carregado pela página não mantém um bloqueio obsoleto. O envio efetivo continua
  repetindo as verificações no servidor.
- O pop-up mostra o nome/e-mail da presidência e o motivo concreto do impedimento.
  O botão “Gerar e enviar à Asten” esclarece quando a operação efetiva ocorre.
- Integração conectada, mas desabilitada por configuração de envio, não exibe mais
  a mensagem de que o envio está pronto. Falha de autorização na consulta à pasta
  orienta a reconectar e conferir acesso ao repositório.
- A solicitação que falha antes de criar um job agora gera o evento de auditoria
  `SOLICITACAO_ASSINATURA_FALHOU`.
- Solicitações pendentes com signatários diferentes dos responsáveis atuais são
  bloqueadas para correção. Envelopes enviados não são redirecionados, modificados
  ou reenviados automaticamente. As proteções contra duplicidade permanecem.

## Verificação e limites

- CI: 691 testes unitários, 17 contratos, TypeScript, acessibilidade estática,
  finalização, build e smoke HTTP aprovados.
- Testes específicos cobrem integração desativada, acesso não autorizado, pasta,
  fila de retorno, Google desconectado e destinatário atualizado. O teste HTTP
  isolado confirma autenticação, mensagem de bloqueio e e-mail da presidência.
- Sem publicação, escrita no Supabase de produção, alteração de credenciais,
  cancelamento remoto, geração de PDF real ou envio de convites de assinatura.
- O sucesso da criação e do envio reais não foi confirmado. Após publicação,
  a conferência atualizada permitirá obter o impedimento concreto da instalação;
  uma credencial/permissão inválida exige regularização própria, sem desativar as
  proteções para simular sucesso.
