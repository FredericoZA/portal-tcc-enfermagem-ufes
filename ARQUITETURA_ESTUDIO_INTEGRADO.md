# Estúdio de Integração

O Estúdio em Configurações é a fonte compartilhada de documentos, e-mails, formulários, variáveis, identidade visual e auditoria. Master e Presidente da Comissão podem publicar alterações, sempre com auditoria e autenticação administrativa recente nas ações críticas.

## Variáveis

O motor reconhece `<<VAR>>`, `{{VAR}}`, `[[VAR]]`, `«VAR»` e `-CAMPO_01-`. Chaves e aliases são consolidados; renomes duplicados são bloqueados; exclusões usadas por algum artefato são recusadas; mesclas reescrevem os vínculos e entram no histórico.

Os quatro tipos obrigatórios são carta-convite, ata, termo e declaração, mas cada Master fornece seus próprios arquivos. Carta-convite não entra na fila Asten.

## Aparência

Planilhas e pop-ups herdam a aparência global enquanto estiverem vinculados. Ao desligar a vinculação, o elemento recebe uma cópia individual editável. Colunas, ordem e linhas por página são configurações próprias de cada planilha. A publicação grava a configuração no servidor para os demais usuários.

## Persistência

No desenvolvimento local, o estado fica em `PORTAL_DATA_DIR`. Com `PORTAL_PERSISTENCE_PROVIDER=supabase`, o runtime v6 grava o agregado versionado e, na mesma transação PostgreSQL, atualiza projeções normalizadas de usuários, processos, arquivos, assinaturas, e-mails e auditoria. A revisão otimista rejeita uma gravação obsoleta e a outbox Asten serializa a criação de envelopes entre instâncias.

O arquivo `supabase/schema/portal_runtime_state.reference.sql` não é uma migração aplicada. Crie a migração pela CLI, revise RLS/grants e valide em um projeto separado antes da produção.

## Implantação

Siga `IMPLANTACAO_PRODUCAO.md`. Vercel é hospedagem, não sincronização; Drive hospeda modelos/arquivos; Supabase persiste dados; Asten assina. Nenhuma dessas integrações é considerada confirmada sem credenciais, teste controlado e evidência nos respectivos painéis.
