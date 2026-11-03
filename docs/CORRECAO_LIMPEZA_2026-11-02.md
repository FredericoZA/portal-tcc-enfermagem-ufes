# Limpeza de TCC — 02/11/2026

## Correção instalada no Supabase

A rotina de expurgo percorria todos os nós de todas as cópias históricas,
inclusive modelos e imagens sem vínculo com o TCC. Também executava o
mesmo cálculo duas vezes por cópia. Isso podia exceder o tempo da chamada
REST e desfazer a transação inteira (57014).

A migração `20261102205917_optimize_process_purge.sql` mantém o contrato
existente, ignora ramos sem a identidade exata procurada e calcula uma vez
por cópia. O filtro textual é conservador: somente as verificações de
identidade já existentes autorizam remover um objeto. A rotina permanece
restrita a `service_role`, recusa processos ativos e protocolos atribuídos
a outro processo.

O comando local `supabase migration new` foi tentado duas vezes; o binário
instalado terminou com SIGKILL. O arquivo incremental foi criado localmente
e aplicado pelo MCP oficial com sucesso.

## Verificação real

- Reexecutado o expurgo do processo excluído TCC-2026-0005.
- Conferidos zero registros do processo, zero registros de auditoria e zero
  cópias históricas com o ID do processo ou do respectivo job.
- A fila foi atualizada pela função de commit transacional existente,
  preservando revisão e todas as outras pendências.
- As três tarefas agora registram `clearHistory=false`.
- Nenhum erro Supabase permanece nessas três tarefas.
- Permissões conferidas: anon/authenticated sem EXECUTE; service_role com EXECUTE.

## Limitação ainda aberta no Asten

O código em `server.ts` não chama um serviço de expurgo: registra um erro
fixo. Não foi localizado o contrato técnico da operação (nome do serviço,
parâmetros, respostas e evidência de exclusão definitiva).

A ajuda oficial distingue lixeira de expurgo e exige cancelar envelopes
pendentes antes de expurgar:
https://ajuda.astenassinatura.com.br/article/88-excluir-ou-expurgar-envelopes

Continuam no inventário de limpeza, sem confirmação de expurgo:

| TCC excluído | Envelopes Asten |
| --- | --- |
| TCC-2026-0003 | 93107, 93108 |
| TCC-2026-0004 | 93156 |
| TCC-2026-0005 | 93160 |

Não apagar o inventário nem marcar essas tarefas como concluídas enquanto
não houver comprovação do provedor. Solicitação da documentação enviada ao
responsável nesta conversa. Não foram chamados endpoints destrutivos por
suposição nem extraídas credenciais de produção.

## Testes locais

Seis testes de exclusão aprovados: idempotência; rejeição de processo ativo;
proteção contra reutilização de protocolo; preservação de outra cópia com
conteúdo volumoso; permissões; Drive, calendário e staging isolados.
TypeScript e verificação de segredos aprovados. A correção do banco já está
ativa e não depende de publicar uma nova versão do frontend na Vercel.
