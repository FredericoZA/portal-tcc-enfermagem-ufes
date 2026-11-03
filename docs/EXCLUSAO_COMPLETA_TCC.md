# Exclusão completa do TCC — desenvolvimento local

A solicitação atual do Master substitui a escolha anterior de preservar arquivos ou histórico: excluir o TCC passa a solicitar a limpeza completa de seus recursos. O backend aplica essa regra, inclusive para clientes antigos que enviem opções falsas. A confirmação ainda identifica o protocolo e exige digitar EXCLUIR. Usuários, modelos e recursos compartilhados com outros TCCs não são excluídos.

## Inventário e execução

- Portal: processo, vínculos, formulários, avaliação, lembretes e registros operacionais do TCC.
- Drive: pasta conferida na árvore do processo e arquivos identificados pelo vínculo do TCC, inclusive versões na lixeira. A exclusão é definitiva, e não um envio à lixeira.
- Supabase: projeções normalizadas, históricos vinculados e conteúdo referente ao processo nas cópias de segurança do aplicativo. Atualizações de backup possuem filtro explícito, conforme a política de atualização segura do banco.
- Supabase Storage: objetos temporários de upload e download vinculados ao processo. A remoção do objeto precisa ser confirmada antes da exclusão do registro que o identifica.
- Google Calendar: eventos identificados pelo ID do TCC no calendário configurado. Eventos antigos sem ID exigem protocolo e data de criação anterior à exclusão; eventos de outro processo não são removidos.
- Asten: os envelopes registrados permanecem pendentes enquanto não houver confirmação efetiva de expurgo pelo provedor. Uma confirmação manual do usuário não conclui essa etapa.

A fila é durável. As falhas podem ser reprocessadas pelo Master e pela manutenção autenticada já agendada em `/api/cron/storage-cleanup`. Respostas de remoção idempotentes (por exemplo, arquivo já removido) permitem retomar a tarefa. Reutilizar um protocolo não autoriza limpar um novo processo com outra identidade.

## Migração preparada

`supabase/migrations/20261026190000_complete_process_cleanup.sql` corrige o UPDATE sem WHERE encontrado na rotina de limpeza de backups, trata a repetição quando o processo normalizado já foi removido e acrescenta vínculo de TCC aos downloads temporários. Não foi aplicada em produção nesta rodada. Deve preceder a próxima publicação autorizada.

## Limites e pendência da Asten

Foi localizada na fonte oficial pública `https://plataforma.astenassinatura.com.br/js/idiomas/pt.js` a descrição do serviço que elimina definitivamente o envelope, no grupo `documentacaoApi`, textos 0501 e 0502. O nome exato do serviço, seu pedido, a confirmação e a semântica de retorno ainda precisam ser conferidos na documentação autenticada. Não foram inventados endpoints nem realizadas chamadas destrutivas para descoberta.

Downloads legados sem identificação de processo seguem a expiração já existente; nome de arquivo ou hash isolados não são usados para excluir um arquivo de titularidade incerta. Cópias recebidas nas caixas de e-mail dos destinatários e backups gerenciados internamente pelos provedores não são recursos que a API atual do Portal pode remover. Não foram ampliados os escopos de acesso ao Gmail.

Os testes usam dados fictícios. Nenhum TCC, arquivo ou envelope real foi excluído, e não houve publicação no Vercel nesta rodada.
