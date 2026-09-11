# Integração Asten e Google Drive

1. O Google Workspace é autorizado por OAuth e o refresh token é cifrado no Supabase.
2. O portal cria a estrutura vazia do Drive; o Master cadastra seus quatro modelos em Configurações.
3. O Master cola o token Asten uma vez em Configurações; o servidor valida a conta e o repositório e cifra o token.
4. Cada etapa elegível gera PDF, versão, nome padronizado, SHA-256 e chave de idempotência.
5. Um usuário autorizado clica em **Assinar documento**. Só então o servidor gera o PDF, registra o hash, arquiva a versão gerada no Drive, cria o envelope e o encaminha pela Asten. A carta-convite nunca entra na Asten.
6. O callback autenticado atualiza o estado. Quando as assinaturas terminam, o servidor baixa o PDF, valida `%PDF-`, confere o hash e arquiva em `01_ASSINADOS` dentro da pasta do tipo documental do processo.
7. Depois que ATA e DECLARAÇÃO estão arquivadas — e também o TERMO quando houve pedido de publicação — o TCC muda para `CONCLUIDO`.

O token Asten, o refresh token Google e a chave Supabase não são enviados ao navegador, salvos em `localStorage`, incluídos em logs ou devolvidos por APIs. As rotas legadas de buffer, aprovação e disparo manual foram desativadas. A tela de assinaturas é somente acompanhamento técnico com reprocessamento seguro para falhas.
