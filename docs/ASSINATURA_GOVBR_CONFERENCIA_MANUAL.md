# Declarações: Gov.br e conferência manual no VALIDAR/ITI

Gov.br pode ser usado junto com a Asten para ata, termo de autorização e declaração, conforme o papel e os pré-requisitos do processo. O orientador e os dois examinadores assinam a ata (três assinaturas no mesmo PDF); autores e orientador assinam o termo; a Presidência assina a declaração. A escolha segue a decisão do usuário de conferir no VALIDAR/ITI e aprovar no Portal.

O fluxo usa a sessão autenticada vigente do Portal, sem solicitar outro código para preparar, devolver ou conferir o PDF. Sessões encerradas ou expiradas continuam exigindo o login normal. Na ata e no termo, o orientador reúne as assinaturas exigidas, assina por último e devolve o PDF; na declaração, a devolução cabe à Presidência. Administradores mantêm acesso operacional, sem substituir os signatários cadastrados.

## Operação

1. Na Área do Presidente, abrir **Gov.br** na declaração e **Gerar e baixar PDF**. O download ocorre diretamente no Portal, sem abrir ou exigir acesso ao Drive. O servidor verifica os mesmos pré-requisitos documentais: avaliação concluída, dados finais, Ata arquivada e Termo aplicável arquivado. O responsável é o Presidente cadastrado, sem substituição pelo usuário que clicou.
2. Assinar pessoalmente o PDF baixado em [Assinador Gov.br](https://assinador.iti.br/). Salvar o PDF devolvido pelo serviço, sem editar ou imprimir novamente.
3. Devolver esse PDF ao Portal. Ele fica privado e pendente de conferência; seu envio não conclui o processo.
4. Baixar o PDF recebido, abrir [VALIDAR/ITI](https://validar.iti.gov.br/) e enviar manualmente o mesmo arquivo ao serviço. Conferir o resultado, o titular esperado e o conteúdo completo. O Portal não transmite o PDF ao ITI automaticamente.
5. Confirmar as três verificações e selecionar **Aprovar conferência e arquivar**. O registro identifica o aprovador, o horário da conferência, a revisão do TCC e os hashes SHA-256 do original e do PDF devolvido.

Se a preparação terminar e o download falhar, o documento preparado permanece disponível em **Baixar PDF para assinar**. Não é necessário gerar outra versão. O Drive é usado apenas pelo servidor para armazenamento.

Se o conteúdo do modelo divergir da versão publicada, a geração continua bloqueada até o responsável revisar o modelo nas Configurações do Portal. Mudanças apenas em revisão/data do Drive não bloqueiam um DOCX cujo conteúdo canônico permanece idêntico. Esse diagnóstico depende da comparação real; um teste local não confirma qual dessas condições ocorreu em produção.

## Limites da conferência

- O Portal verifica estrutura PDF, quantidade e dimensões das páginas, conteúdo e recursos das páginas e presença de campo de assinatura digital com ByteRange cobrindo o arquivo. O hash vincula a aprovação ao binário exato.
- Essas verificações **não validam a cadeia de certificados, o titular ou o CMS criptograficamente**. A aprovação é uma declaração humana de conferência no serviço oficial, registrada como `MANUAL_VALIDAR_ITI`. O Portal não inventa uma data de assinatura extraída do certificado.
- A comparação de conteúdo é conservadora: PDFs reimpressos, reescritos com mudança dos fluxos de página ou editados podem ser recusados. A compatibilidade com um PDF assinado pessoalmente no Gov.br ainda exige um piloto real.
- Mudança dos dados do processo, do responsável esperado ou do PDF exige nova conferência. Após aprovar, o arquivo não pode ser substituído.
- Enquanto o documento está pendente, Asten e Gov.br são independentes: preparar um deles não cancela nem bloqueia o outro. Após a assinatura concluída na revisão atual, não é permitido iniciar nova assinatura por nenhum provedor; ficam disponíveis Ver e Baixar PDF. Cada serviço preserva seu PDF, suas assinaturas e seu histórico. Repetir Asten recupera a mesma solicitação; um resultado Asten incerto exige reconciliação nessa plataforma, sem impedir Gov.br.

## Armazenamento e recuperação

Em produção, o upload usa o transporte temporário privado existente no Supabase e está vinculado à sessão, ao processo, à finalidade, ao tamanho, ao MIME e ao checksum. O servidor grava o PDF pendente no Drive privado como `PENDENTE_CONFERENCIA`, na área de gerados. A aprovação copia os mesmos bytes para o arquivo assinado canônico e somente então define `ARCHIVED`.

Se o Drive falhar, a conferência fica registrada e o estado permanece `DRIVE_SYNC_PENDING`; **Repetir arquivamento** usa o mesmo hash e mantém o aprovador original. A trilha durável distingue recebimento de aprovação. Rotas antigas de upload simulado em lote continuam desativadas.

No desenvolvimento `local_file` com `PORTAL_TEST_DOCUMENT_RENDERER=true`, o PDF tem identificação de teste e fica em `.portal-data/govbr-pdfs/`, com referência baseada no hash e leitura autenticada. Essa alternativa é bloqueada em produção/Vercel. Os testes usam CMS fictício e dados isolados: não homologam assinatura real, ITI, Supabase remoto ou Drive real.

## Validação técnica

- `server/integrations/govbrManualReview.test.ts`: PDF sem assinatura, conteúdo alterado, bytes adicionais, hash divergente, revisão e confirmações obrigatórias.
- `server/govbrHttpFlow.test.ts`: servidor isolado, permissões, conflito Asten, preparação idempotente, upload pendente, aprovação por hash, download dos mesmos bytes, auditoria, reinício e bloqueio após mudança da revisão.
- `npm run test:secure-flow`: mantém bloqueios do upload legado e das operações não autorizadas.

Referências oficiais: [Serviço de assinatura eletrônica](https://www.gov.br/pt-br/servicos/assinatura-eletronica) e [VALIDAR](https://validar.iti.gov.br/).

## Modelo divergente durante a preparação

Se o arquivo ativo tiver mudado desde a publicação, o Portal não gera um
oficial com conteúdo não revisado. Master e Presidência podem usar **Visualizar
modelo atual** no próprio pop-up Gov.br. A amostra é identificada como sem
validade. Depois de carregá-la e conferir o conteúdo, **Publicar modelo revisado
e baixar PDF** registra nova versão e tenta gerar o documento real do TCC.

O servidor confere arquivo, versão publicada e hash da amostra. Uma mudança
posterior exige nova revisão. O histórico anterior e a auditoria são preservados.
Alunos e outros participantes não podem publicar modelos. Não há repetição de
OTP nessa operação autenticada de revisão do fluxo Gov.br.
