# Ver e baixar os PDFs públicos

Na ficha pública do trabalho, abra **Repositório acadêmico**. Trabalho completo e resumo expandido têm escolhas independentes de publicação. Somente um arquivo público recebe os botões **Ver** e **Baixar PDF**, com o mesmo componente e cores dos documentos administrativos. O acesso restrito dos participantes e da administração continua separado.

O navegador consulta a rota pública do arquivo com `delivery=drive-links`. O servidor reaplica a autorização já existente: processos atuais exigem conclusão, autorização expressa, termo arquivado e revisão atual; registros históricos exigem consentimento de origem sem recusa ou conflito e hash conferido. Arquivos privados são recusados antes da chamada ao Google.

A primeira consulta verifica o SHA-256 fornecido pelo Drive e cria no próprio Drive uma cópia identificada com processo, origem e hash. Apenas essa cópia recebe leitura pública por link, sem descoberta em buscas. Os originais e suas pastas continuam privados. Não há download/reupload do binário pela Vercel. Consultas posteriores verificam metadados e permissões e reutilizam a cópia. Cópias alteradas, privadas ou retiradas não são republicadas por um clique.

A revisão do banco é conferida antes e depois da preparação. Se mudar durante a operação, o servidor recusa o link e tenta descartar a cópia recém-criada. Uma mudança não relacionada pode exigir repetir o clique. Links de navegador só são aceitos em HTTPS nos domínios oficiais do Google, sem credenciais.

A retirada administrativa é confirmada no banco antes da limpeza no Drive. A limpeza inclui as cópias derivadas, mesmo quando o registro antigo apontava apenas para o original. Falhas de limpeza retornam pendência e permitem repetir a retirada; não retornam sucesso antecipado. A exclusão integral de um processo também encontra as cópias pelo vínculo de processo.

A entrega antiga dos bytes permanece para compatibilidade com clientes existentes. O fallback local com PDF fictício só funciona no adaptador de testes já existente; não habilita serviço externo nem altera permissões reais. Testes simulados não comprovam permissões ou downloads reais no Drive.

A restauração de backup não pode alterar os arquivos públicos de registros já existentes: ela não pode retirar um registro público, trocar seu PDF, reverter uma recusa nem revogar silenciosamente o consentimento. Isso evita cópias públicas órfãs ou uma republicação indireta. As escolhas vigentes devem ser preservadas no backup; a retirada administrativa continua sendo o caminho para revogar publicações atuais.
