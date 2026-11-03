# Imagens permanentes no Google Drive

Os PDFs de TCC, formulários e documentos já usam o Drive como arquivo definitivo.
O transporte privado e temporário de arquivos grandes continua separado desse
arquivo e mantém seus limites e sua limpeza.

Esta atualização também arquiva as imagens de identidade/modelos e as capturas
das sugestões no Drive privado. O Supabase passa a guardar somente referências,
tipo, tamanho e SHA-256. As URLs públicas opacas das imagens de identidade e a
consulta privada de capturas pelo Master permanecem iguais.

## Ordem de implantação

1. A migração `20261103193915_drive_backed_permanent_images.sql` foi aplicada
   à base principal pela API de migrações do Supabase em 03/11/2026. O número
   foi relido do histórico do provedor; o CLI local retornou SIGKILL e não foi usado.
2. A releitura confirmou as quatro colunas novas, as três imagens antigas
   preservadas e a ausência de acesso direto de `anon` ou `authenticated`.
   Em outra instalação, aplicar essa alteração aditiva antes do novo código.
3. Publicar e testar o novo leitor. Sem a migração, leituras antigas continuam
   disponíveis; novos envios com imagem são recusados antes de gravar no Drive.
4. No ambiente protegido da instalação, executar
   `node --import tsx scripts/backfill-drive-runtime-images.ts` para inventário.
   A opção `--apply` arquiva as imagens, confere SHA-256 pela releitura do Drive
   e grava as referências. Não apaga os bytes antigos, não cria novas URLs e
   pode ser repetida após uma interrupção.
5. Conferir as três imagens existentes por suas URLs públicas após a publicação,
   inclusive a variante PNG de e-mail. Conferir uma sugestão de teste com captura
   no Master. Registrar o resultado e o commit da publicação.
6. Somente após essa conferência, retirar `data_url` das linhas verificadas com
   atualização condicional por `asset_key`, `drive_file_id` e `content_sha256`.
   Conferir o resultado novamente. Não há expurgo automático nesta preparação.

As pastas de imagens são `04_ATIVOS_VISUAIS` e `05_IMAGENS_SUGESTOES`, sob a
raiz técnica externa configurada em `PORTAL_DRIVE_TECHNICAL_FOLDER_ID`. As pastas
acadêmicas continuam limitadas aos documentos e processos. A migração não torna
nenhum arquivo público no Drive e não expõe IDs de arquivos ao navegador.

A auditoria também encontrou cópias das mesmas imagens antigas em dois eventos
de auditoria e em um snapshot histórico do banco. Elas não são TCCs nem PDFs,
não são arquivos únicos e não são apagadas por este backfill. O histórico é
preservado; uma eventual compactação exige arquivar e verificar sua cópia
original no Drive antes de alterar qualquer registro histórico.

Se o banco não confirmar uma gravação após o Drive ter recebido a imagem, o
arquivo é preservado com `imageKey` e SHA-256 para recuperação. Não apagar esse
arquivo sem verificar se o registro foi confirmado em outra tentativa.
