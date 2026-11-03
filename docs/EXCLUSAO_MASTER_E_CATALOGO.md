> Atualização local posterior: a exclusão completa substitui as opções independentes descritas abaixo. Consulte [EXCLUSAO_COMPLETA_TCC.md](./EXCLUSAO_COMPLETA_TCC.md). Esta revisão ainda não foi publicada.

# Exclusão pelo Master e catálogo operacional

O Master configurado pode excluir um TCC em qualquer etapa, mesmo com documentos no Drive ou assinaturas. A confirmação identifica o protocolo e exige digitar EXCLUIR. Duas opções independentes permitem remover os arquivos e limpar o histórico do TCC, inclusive o registro da própria exclusão. Por padrão, as opções ficam desmarcadas.

A limpeza externa é posterior ao registro durável da exclusão. Falhas ficam na fila de limpezas do Monitor operacional. O Drive é limitado à árvore conferida do TCC e aos arquivos com vínculo comprovado; modelos e arquivos compartilhados são preservados. Envelopes Asten exigem expurgo na plataforma e confirmação explícita na fila: cancelamento não é expurgo. Não foram excluídos dados reais nos testes.

O banco usa a migração `20261026160000_master_process_purge.sql`. A função de limpeza é exclusiva de service_role e recusa apagar a projeção de um processo ainda ativo. A auditoria continua protegida fora dessa exclusão específica. Backups do aplicativo são limpos apenas de objetos vinculados ao processo; backups gerenciados pelo provedor seguem a retenção do provedor.

Configurações apresenta nove tipos de mensagem: solicitação ao departamento, cadastro recebido pelos autores/orientador, reserva confirmada, resposta registrada ao departamento, indisponibilidade, convite à banca, entrega final após a ata, termo aplicável e conclusão. Uma negativa é uma alternativa à confirmação, não um décimo envio. Mensagens personalizadas adicionais são preservadas. Destinatários operacionais continuam restritos aos envolvidos na etapa.

Formulários inclui cadastro do aluno e homologação do departamento. O título, os rótulos e o botão do formulário do departamento usam o Estúdio publicado. Os locais são os solicitados no TCC; a validação da data, do horário e da resposta não é removida por alterações visuais. Os quatro modelos documentais existentes são preservados.
