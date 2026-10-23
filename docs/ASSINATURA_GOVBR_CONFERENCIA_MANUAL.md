# Declarações: Gov.br e conferência manual no VALIDAR/ITI

O Master e o Presidente podem usar Gov.br como alternativa para **declarações de participação**. Ata e Termo mantêm o fluxo automático Asten. A escolha segue a decisão do usuário de conferir no VALIDAR/ITI e aprovar no Portal.

## Operação

1. Na Área do Presidente, abrir **Gov.br** na declaração e **Preparar declaração**. O servidor verifica os mesmos pré-requisitos documentais: avaliação concluída, dados finais, Ata arquivada e Termo aplicável arquivado. O responsável é o Presidente cadastrado, sem substituição pelo usuário que clicou.
2. Baixar o original e assinar pessoalmente em [Assinador Gov.br](https://assinador.iti.br/). Salvar o PDF devolvido pelo serviço, sem editar ou imprimir novamente.
3. Devolver esse PDF ao Portal. Ele fica privado e pendente de conferência; seu envio não conclui o processo.
4. Baixar o PDF recebido, abrir [VALIDAR/ITI](https://validar.iti.gov.br/) e enviar manualmente o mesmo arquivo ao serviço. Conferir o resultado, o titular esperado e o conteúdo completo. O Portal não transmite o PDF ao ITI automaticamente.
5. Confirmar as três verificações e selecionar **Aprovar conferência e arquivar**. O registro identifica o aprovador, o horário da conferência, a revisão do TCC e os hashes SHA-256 do original e do PDF devolvido.

## Limites da conferência

- O Portal verifica estrutura PDF, quantidade e dimensões das páginas, conteúdo e recursos das páginas e presença de campo de assinatura digital com ByteRange cobrindo o arquivo. O hash vincula a aprovação ao binário exato.
- Essas verificações **não validam a cadeia de certificados, o titular ou o CMS criptograficamente**. A aprovação é uma declaração humana de conferência no serviço oficial, registrada como `MANUAL_VALIDAR_ITI`. O Portal não inventa uma data de assinatura extraída do certificado.
- A comparação de conteúdo é conservadora: PDFs reimpressos, reescritos com mudança dos fluxos de página ou editados podem ser recusados. A compatibilidade com um PDF assinado pessoalmente no Gov.br ainda exige um piloto real.
- Mudança dos dados do processo, do responsável esperado ou do PDF exige nova conferência. Após aprovar, o arquivo não pode ser substituído.
- Uma assinatura Asten já iniciada ou de resultado incerto bloqueia o início paralelo por Gov.br. Iniciar Gov.br substitui somente tentativas Asten ainda não encaminhadas.

## Armazenamento e recuperação

Em produção, o upload usa o transporte temporário privado existente no Supabase e está vinculado à sessão, ao processo, à finalidade, ao tamanho, ao MIME e ao checksum. O servidor grava o PDF pendente no Drive privado como `PENDENTE_CONFERENCIA`, na área de gerados. A aprovação copia os mesmos bytes para o arquivo assinado canônico e somente então define `ARCHIVED`.

Se o Drive falhar, a conferência fica registrada e o estado permanece `DRIVE_SYNC_PENDING`; **Repetir arquivamento** usa o mesmo hash e mantém o aprovador original. A trilha durável distingue recebimento de aprovação. Rotas antigas de upload simulado em lote continuam desativadas.

No desenvolvimento `local_file` com `PORTAL_TEST_DOCUMENT_RENDERER=true`, o PDF tem identificação de teste e fica em `.portal-data/govbr-pdfs/`, com referência baseada no hash e leitura autenticada. Essa alternativa é bloqueada em produção/Vercel. Os testes usam CMS fictício e dados isolados: não homologam assinatura real, ITI, Supabase remoto ou Drive real.

## Validação técnica

- `server/integrations/govbrManualReview.test.ts`: PDF sem assinatura, conteúdo alterado, bytes adicionais, hash divergente, revisão e confirmações obrigatórias.
- `server/govbrHttpFlow.test.ts`: servidor isolado, permissões, conflito Asten, preparação idempotente, upload pendente, aprovação por hash, download dos mesmos bytes, auditoria, reinício e bloqueio após mudança da revisão.
- `npm run test:secure-flow`: mantém bloqueios do upload legado e das operações não autorizadas.

Referências oficiais: [Serviço de assinatura eletrônica](https://www.gov.br/pt-br/servicos/assinatura-eletronica) e [VALIDAR](https://validar.iti.gov.br/).
