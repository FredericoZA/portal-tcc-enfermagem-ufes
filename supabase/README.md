# Preparação do Supabase

Este diretório versiona as migrações do Portal. Em uma instalação nova, aplique a cadeia em ordem. Em uma instalação existente, confira primeiro o histórico remoto por nome e versão: algumas migrações da produção foram registradas pelo painel com outro horário. Uma diferença no prefixo do arquivo não autoriza reaplicar o SQL.

1. Instale e autentique a CLI do Supabase.
2. Vincule este repositório ao projeto correto.
3. Aplique **todos** os arquivos de `migrations/` pela ordem do nome, sem pular versões.
4. Confirme que o bucket usado para staging está privado. Ele não substitui o Google Drive e não deve conter arquivo permanente.
5. Revise RLS e grants e rode os testes em Configurações → Sincronização.

O runtime v6 grava o agregado do portal e as projeções relacionais normalizadas na mesma transação PostgreSQL. Cada commit exige a revisão esperada, impedindo sobrescrita silenciosa entre instâncias. As migrações v4 e v5 incluem identidade da instalação, períodos, flags, aceite de coautoria, hash de assinados, transferências administrativas e transporte privado temporário de arquivos. A migração `202609060001_asten_transactional_outbox_v6.sql` acrescenta a outbox transacional que impede criação duplicada de envelope Asten entre instâncias. O Drive continua sendo o arquivo definitivo dos documentos binários.

No fluxo atual, PDFs e DOCX vão para a pasta técnica privada do Google Drive e depois para o destino definitivo no Drive. O Supabase registra os metadados da transferência. O bucket antigo fica privado para compatibilidade com registros anteriores; não o use para novos documentos. Veja [a configuração de produção no README](../README.md).

As variáveis `SUPABASE_URL` e `SUPABASE_SECRET_KEY` são exclusivas do servidor. Nunca use prefixo `VITE_` para a chave secreta.

O painel diferencia conexão do Supabase, esquema normalizado, runtime transacional v6, outbox Asten e transporte privado. Teste real de upload, concorrência, carga e failover permanece obrigatório antes de abrir o ambiente definitivo.

A migração `20261106001943_runtime_audit_delta.sql` habilita a leitura incremental do histórico de auditoria. Uma instância aquecida pode reutilizar blocos já confirmados, e uma instância nova recebe o histórico completo. A revisão e os dados vêm da mesma leitura PostgreSQL. O commit, os backups e a restauração mantêm o snapshot completo. Em produção, o Portal tenta a RPC por padrão e usa a leitura integral quando o PostgREST confirma que a RPC ainda não existe. Defina `PORTAL_RUNTIME_AUDIT_DELTA=false` para voltar à leitura integral.
