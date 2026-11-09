# Revisão local — reservas e identidade institucional

## Comprovantes

- Título e autores são apresentados com rótulo, dois-pontos e valor na mesma linha. Cada autor possui sua própria linha, mantendo a ordem do processo e o retrato salvo na resposta.
- O comprovante registra a origem do link e a data/hora em Brasília. O sistema não recebe a identidade da conta que abriu um link encaminhado: não registra essa conta como se estivesse autenticada.
- Novas respostas de locais geridos pelo departamento identificam seu destinatário institucional também na cópia pública. E-mails de autores, matrículas e e-mails pessoais de orientadores em locais externos continuam fora dessa cópia.
- Registros antigos sem essa atribuição institucional permanecem com o tratamento anterior; não se inventa uma nova identidade para uma resposta antiga.

## E-mail configurável

Em Configurações → E-mails, selecione a solicitação de reserva. O campo “E-mail do departamento para reservas” define o destinatário dos próximos pedidos. O item correspondente em Fluxos abre esse modelo. O endereço informado nesta revisão é dptenfccs@gmail.com. A configuração foi preparada apenas na prévia local; nenhuma configuração publicada foi alterada.

O destinatário fica vinculado à revisão da solicitação. Alterar a configuração não invalida links já enviados. Mensagens anteriores à criação desse vínculo podem ser reconhecidas pelo registro de envio, desde que contenham o mesmo token assinado, destinatário e revisão. Um novo agendamento retira o vínculo antigo e usa a configuração vigente. Token expirado, adulterado ou de outra revisão continua recusado.

## Negativa

A resposta é persistida antes de gerar o comprovante e acionar as comunicações. Recusa nova usa estado RECUSADO. O calendário também reconhece as recusas históricas guardadas em departmentResponse com localStatus PENDENTE. O processo e seu protocolo permanecem no repositório; apenas o agendamento sai da agenda. O aviso é único, em grupo, e oferece comprovante e “Solicitar nova data”, orientando a combinar a disponibilidade antes de reenviar. Repetir o clique não cria outra resposta ou outro aviso.

Retomar um arquivamento recusado não deve executar o evento LOCATION_CONFIRMED.

## Brasão

O arquivo fornecido pelo usuário foi preservado, byte a byte, nos recursos público e servidor. Comprovante, cadastro, registros de formulários, declaração de comparecimento, capa do manual e envelope institucional dos e-mails usam o brasão da UFES. A marca da navegação do portal é independente.

Os modelos DOCX/Google Docs têm imagens próprias no Drive. O renderizador substitui em cópias temporárias imagens identificadas como Colenf pelo título, descrição ou URI de origem. Imagens sem identificação não são substituídas por aproximação. Essa parte exige conferência dos modelos ativos no Drive na homologação; os testes locais não comprovam sua aparência real. PDFs existentes e assinados permanecem intactos.

A API Google Docs permite replaceImage com CENTER_CROP, diferentemente da API de Slides. Contrato consultado: https://developers.google.com/workspace/docs/api/reference/rest/v1/documents/request#ReplaceImageRequest

## Limites desta rodada

Sem alteração de dados, credenciais ou arquivos de produção, sem disparo real de e-mails, sem publicação na Vercel. Exemplos e testes usam dados fictícios. A revisão do incidente real TCC-2026-0006 exige conferir o estado publicado e o registro de envio/retorno daquela solicitação; o PDF isolado comprova a emissão do documento, mas não basta para certificar todo o fluxo em produção.
