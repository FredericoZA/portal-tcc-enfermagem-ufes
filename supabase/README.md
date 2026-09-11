# Preparação do Supabase

Este diretório contém apenas o SQL de referência. Nenhuma alteração foi aplicada a um projeto remoto.

1. Instale e autentique a CLI do Supabase.
2. Vincule este repositório ao projeto correto.
3. Aplique **todos** os arquivos de `migrations/` pela ordem do nome, sem pular versões.
4. Confirme que o bucket usado para staging está privado. Ele não substitui o Google Drive e não deve conter arquivo permanente.
5. Revise RLS e grants e rode os testes em Configurações → Sincronização.

O runtime v6 grava o agregado do portal e as projeções relacionais normalizadas na mesma transação PostgreSQL. Cada commit exige a revisão esperada, impedindo sobrescrita silenciosa entre instâncias. As migrações v4 e v5 incluem identidade da instalação, períodos, flags, aceite de coautoria, hash de assinados, transferências administrativas e transporte privado temporário de arquivos. A migração `202609060001_asten_transactional_outbox_v6.sql` acrescenta a outbox transacional que impede criação duplicada de envelope Asten entre instâncias. O Drive continua sendo o arquivo definitivo dos documentos binários.

O Supabase Storage recebe somente uploads temporários de DOCX e PDF por URL assinada. O servidor vincula cada ticket à sessão, finalidade e processo, confere tamanho, MIME e SHA-256, envia o arquivo ao destino definitivo e remove o objeto temporário. O bucket deve permanecer privado, sem política de leitura anônima.

As variáveis `SUPABASE_URL` e `SUPABASE_SECRET_KEY` são exclusivas do servidor. Nunca use prefixo `VITE_` para a chave secreta.

O painel diferencia conexão do Supabase, esquema normalizado, runtime transacional v6, outbox Asten e transporte privado. Teste real de upload, concorrência, carga e failover permanece obrigatório antes de abrir o ambiente definitivo.
