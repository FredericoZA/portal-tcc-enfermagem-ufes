# Atualização e rollback

## Antes de atualizar

1. Exporte o backup administrativo e guarde uma cópia privada.
2. Registre a versão atual da Vercel e a revisão do banco.
3. Verifique que os documentos importantes também existem no Drive.
4. Leia as novas migrações e aplique-as primeiro em homologação.
5. Rode `npm ci` e `npm run test:ci` no pacote novo.

## Implantação

Migrações são incrementais e devem ser aplicadas na ordem do nome. Faça o deploy em preview, execute o roteiro de homologação e só então promova para produção. Não restaure uma versão de código anterior sobre um esquema novo sem verificar compatibilidade.

## Rollback

Se o erro estiver apenas na interface ou no servidor, reverta o deployment da Vercel e preserve o banco. Se uma migração causou o problema, interrompa mutações, preserve snapshot e logs e faça uma migração corretiva; não apague tabelas nem use comandos destrutivos em produção. Credencial possivelmente exposta deve ser rotacionada antes de reabrir o portal.

## Recuperação documental

O Drive é o arquivo humano e não deve ser reconstruído a partir de links públicos. Use protocolo, aluno, tipo, versão e hash do manifesto para localizar artefatos. O Supabase restaura estado e permissões; o dossiê institucional auxilia a conferência, mas não substitui o backup do banco.

## Atualização para RC7

Leia `FLUXO_OPERACIONAL_RC7.md`. Abra o Estúdio para preparar o rascunho migrado, preencha o e-mail do departamento e publique após conferir formulários, modelos e sequência. A nova Declaração usa `PUBLICATION_CLEARED`, após Ata e Termo aplicável arquivados. Processos com efeitos externos exigem conferência antes de reaplicar eventos. O código RC7 mantém o runtime Supabase v6 e não acrescenta migração SQL; os campos opcionais integram o estado transacional existente.

## Atualização para RC8

Leia `FLUXO_OPERACIONAL_RC8.md`. A RC8 mantém o runtime transacional Supabase v6 e acrescenta campos opcionais no estado já versionado; não há nova migração SQL. Abra o Estúdio, confira os valores iniciais de validade dos rascunhos, calendário útil, feriados, política de identidade, análise de layout e prazos. Refaça a amostra de cada modelo pelo Google e compare o rascunho com a revisão publicada antes de publicar. O código não ativa lembretes nem modifica o fluxo publicado automaticamente.

Rascunhos anteriores continuam preservados. Quando o esquema do cadastro muda, o aluno precisa revisar a versão atual antes do envio. Processos antigos sem comprovante de reserva, marcações de etapa ou categorias analíticas continuam válidos; os campos permanecem ausentes e nunca são inventados. Antes de reexecutar qualquer etapa com efeito externo, use a Central de Andamento para conferir Gmail, Asten e Drive.
