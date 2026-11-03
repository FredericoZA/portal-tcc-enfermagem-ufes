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

## Aplicação da finalidade — 03/11/2026

A migração `20261103210924_location_proof_staging.sql` foi aplicada à base principal
pelo conector de migrações do Supabase, após revisão do SQL. O número foi relido do
histórico do provedor. A CLI local retornou SIGKILL; nenhuma proteção do Mac foi
contornada. A releitura confirmou a finalidade LOCATION_PROOF, os demais limites e
constraints preservados, RLS forçada e ausência de SELECT para anon/authenticated.
Essa atualização do banco não comprova a publicação do código na Vercel.

O teste PGlite aplicou a mudança sobre as migrações reais de transporte e Gov.br:
preservou os tickets existentes, aceitou as seis finalidades previstas e recusou
finalidade desconhecida, MIME incorreto e tamanho acima do limite. As permissões
e as outras constraints permaneceram idênticas antes e depois.

Validação local: anexação e download de PDF com mais de 1 MB, permissões existentes,
finalidade e vínculo de processo, limite de 24 MB e rejeição de MIME incorreto. Essa
validação não comprova o transporte real do Supabase nem o arquivamento real no Drive.
