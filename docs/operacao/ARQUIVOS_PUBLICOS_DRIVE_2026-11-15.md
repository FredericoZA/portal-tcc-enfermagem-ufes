# Ver e baixar os originais no Drive

**Ver** abre o arquivo original específico no Google Drive. O Portal seleciona o ID já persistido no processo, no documento assinado, no comprovante ou no índice autorizado do acervo legado. A rota mantém os controles de sessão, papel, publicação, avaliação privada e versão. Não aceita uma URL ou um ID arbitrário enviado pelo navegador.

O destino de visualização é `https://drive.google.com/file/d/ID/view`. Sua resolução não depende de OAuth do servidor, não consulta permissões no Google, não baixa bytes e não inspeciona o PDF. O Google Drive autentica a conta aberta no navegador e aplica as permissões existentes; um arquivo privado pode apresentar acesso negado no próprio Google. Se o Portal não tiver um vínculo válido com o original, apresenta a pendência e não substitui o clique por uma prévia interna.

**Baixar PDF** continua como ação separada. Os contratos de download autenticado e público de bytes permanecem protegidos e conferem o arquivo quando efetivamente solicitados. A abertura do original não altera consentimento, não concede acesso, não cria pastas nem copia arquivos.

Nos processos atuais, a emissão autorizada prepara a leitura pública de comprovante e convite; o pós-arquivamento faz o mesmo para ata, termo aplicável e declaração assinados. TCC e resumo só recebem leitura pública no evento de conclusão, com documentação e consentimento individual válidos. O publicador revalida a autorização durante a operação, usa o hash exato e protege a edição dos novos originais. Uma falha fica na retomada do evento existente. Um clique posterior nunca concede permissão como atalho.

Nos históricos, o consentimento original e a evidência de origem continuam limitando cada PDF acadêmico. Somente ata, termo de autorização e declaração identificados podem aparecer como administrativos públicos. Instrumentos de avaliação e convites históricos permanecem restritos. A avaliação exige o papel histórico autorizado ou o acesso Master, inclusive para obter seu link original.

A reabertura da entrega e a retirada administrativa continuam removendo a leitura pública antes de permitir troca de arquivo ou encerrar a revogação. A restauração de backup preserva retiradas e não troca os originais públicos de registros existentes. Na renovação histórica, um editor nominal adicional fica preservado; se ele impedir a proteção do original público, a publicação permanece pendente para revisão.

A migração das cópias da implementação anterior confere vínculo, tipo PDF e SHA-256 antes de retirar a leitura e enviar somente duplicatas verificadas à lixeira. Nas pastas de processo com layout plano, uma edição herdada que impeça a proteção do novo original bloqueia a publicação. O Portal não cria uma subpasta nem move o original para contornar essa restrição.

O arquivo privado `00 - Dados do processo.md` espelha os dados acadêmicos pelo mesmo ID. Edições cadastrais são persistidas antes da atualização no Drive. Falha posterior mantém o cadastro salvo e registra pendência com retentativa pelo Master. Operações documentais também tentam atualizar esse arquivo; legado sem pasta original vinculada não cria outra pasta apenas para editar consentimento.

Entrar no Google pelo navegador não renova o OAuth do Portal. Para operações de sincronização e escrita, o Master pode reconectar em **Configurações → Google Drive → Conectar Google**, pelo endpoint `/api/integrations/google/oauth/start?returnTo=/?google=connected`. A substituição da autorização exige autenticação recente no Portal. O estado `connected` indica autorização armazenada, sem garantir que o refresh token ainda seja aceito. Essa conexão não é requisito para o clique Ver de um arquivo já espelhado.

Testes locais e adaptadores demonstrativos não comprovam a escrita no Drive real, as permissões efetivas das contas Google ou uma publicação em produção.
