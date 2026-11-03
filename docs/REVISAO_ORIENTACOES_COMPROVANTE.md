# Orientações e comprovante de reserva — próxima publicação

Alterações locais solicitadas durante os testes:

- Mensagem de cadastro concluído reduzida ao envio do pedido e à próxima etapa.
- Instruções usam os nomes das abas e dos botões; edição indicada pelo ícone de edição.
- Aviso de nomes mais curto, sem perder as orientações de capitalização e espaços.
- Guia e instruções de e-mail não anunciam mais o teto antigo de 1 MB.
- Comprovante com finalidade própria LOCATION_PROOF no transporte privado existente,
  vinculado à sessão e ao processo, com verificação de checksum, MIME e PDF.
- Limite operacional de 24 MB; análise de até 60 páginas. O arquivo não passa em
  Base64 pela função de produção. O fallback de desenvolvimento permanece em 2 MB.

## Aplicação na próxima publicação autorizada

O Vercel publicado permanece na versão 181992d. Nenhuma alteração deste lote foi
publicada ou aplicada no banco.

Antes de publicar o novo código, incluir LOCATION_PROOF na constraint de finalidades
existente, preservando as finalidades atuais, RLS, grants e quotas. SQL preparado em
`supabase/pending/location_proof_staging.sql`. A CLI local foi encerrada com SIGKILL
antes de gerar a migration; não foi contornada nenhuma proteção do Mac. Gerar a
migration pela CLI quando disponível ou aplicar o SQL revisado pelo conector durante
a próxima publicação autorizada e registrar sua aplicação. Não ampliar acesso público.

Validação local: anexação e download de PDF com mais de 1 MB, permissões existentes,
finalidade e vínculo de processo, limite de 24 MB e rejeição de MIME incorreto. Essa
validação não comprova o transporte real do Supabase nem o arquivamento real no Drive.
