# Política de segurança

## Relato responsável

Não abra uma issue pública com e-mails, documentos, tokens, URLs assinadas, dados pessoais ou passos exploráveis. Envie o relato ao mantenedor indicado pela implantação e informe: versão, rota afetada, impacto, reprodução mínima sem dados reais e sugestão de correção.

## Segredos

- Somente o backend lê chaves Supabase, OAuth Google, token Asten e segredos de sessão, OTP, verificação e webhook.
- Nenhum segredo pode usar prefixo `VITE_`, entrar em `localStorage`, log, ZIP, commit ou captura de tela.
- Use valores independentes, rotacione-os após suspeita e mantenha ambientes de homologação e produção separados.
- O token Asten é inserido em Configurações e cifrado no servidor; nunca deve ser enviado por chat ou e-mail.

## Controle de acesso

Toda rota privada exige sessão autenticada e autorização por função ou vínculo no processo. O Google Drive permanece privado ao Master; o portal atua como mediador dos downloads. Revogação de participante impede novas consultas, detalhes e downloads, sem apagar o histórico de auditoria.

## Homologação

Antes de dados reais, execute `npm run test:ci`, `npm run test:secure-flow` e o roteiro de `docs/TESTES_HOMOLOGACAO.md`. Use PDF sem valor jurídico e destinatários controlados no primeiro teste Asten.

## Suporte de versões

A instalação deve acompanhar a versão mais recente publicada pelo mantenedor. Correções de segurança não são garantidas para snapshots modificados sem testes ou para implantações com migrações incompletas.
