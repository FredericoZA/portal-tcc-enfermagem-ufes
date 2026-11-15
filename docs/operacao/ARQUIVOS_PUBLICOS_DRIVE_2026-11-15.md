# Ver e baixar os PDFs públicos

Na ficha pública do trabalho, abra **Repositório acadêmico**. Trabalho completo e resumo expandido têm escolhas independentes de publicação. Somente um arquivo autorizado como público recebe **Ver** e **Baixar PDF**, com o mesmo componente dos documentos administrativos.

A entrega usa o original do Google Drive. Não cria cópia, não baixa/reenvia o PDF e mantém as pastas privadas. O servidor confere o consentimento vigente, o vínculo do arquivo e o SHA-256 informado pelo Google. Configura apenas leitura pública por link (`anyone:reader`, sem descoberta em buscas). Somente o proprietário pode editar: colaboradores nominais com escrita no arquivo passam a leitores; se o Google impedir essa restrição, o Portal recusa a publicação.

Nos processos atuais, o fluxo vincula o original após a documentação necessária; a leitura pública é liberada no acesso ao arquivo somente após a conclusão do processo. A escolha inicial de publicação continua sujeita à autorização expressa, aos termos e às regras de conclusão. Nos históricos, valem o consentimento original e o hash conferido. Os botões consultam novamente a autorização; cada link abre o original no Google.

A reabertura da entrega retira a leitura no Drive antes de limpar o consentimento ou permitir a troca dos arquivos. A retirada administrativa bloqueia a publicação no banco antes de remover a leitura pública no Drive. Falhas de revogação ficam pendentes e permitem repetir a operação. Históricos usam **Retirar publicação histórica**, sem apagar a evidência de consentimento de origem. Arquivos privados, recusados, com conflito ou com hash divergente não são publicados.

A versão anterior criou cópias públicas. A migração confere vínculo, tipo PDF e SHA-256 antes de enviar somente essas duplicatas à lixeira, após liberar o original. A permissão pública da cópia é removida antes da limpeza. Conteúdo divergente é preservado sem leitura pública. O original nunca é apagado ou movido por essa migração. A lixeira mantém a recuperação pelo proprietário; a liberação de espaço depende da política de lixeira do Google Drive.

O Portal confere a revisão do consentimento durante a sincronização e revoga a leitura pública se ela mudar. A restauração de backup preserva os controles de retirada e não pode trocar os arquivos públicos de registros existentes. A rota antiga de bytes permanece para compatibilidade; os botões usam links diretos. O adaptador local isolado continua sem permissões reais. Testes locais não comprovam o funcionamento do Drive real.

Se a pasta de origem impuser edição herdada que não pode ser reduzida no arquivo, o Portal cria uma subpasta privada da conta proprietária, desativa sua herança e move o mesmo original para ela. O ID e o conteúdo são preservados. Nenhuma permissão das pastas gerais é alterada; somente a nova subpasta tem acesso limitado. A origem e a nova localização são conferidas antes de liberar o link.
