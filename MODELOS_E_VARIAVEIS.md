# Modelos, variáveis e organização do Drive

## Modelos obrigatórios do Master

| Documento | Cadastro | Assinatura |
|---|---|---|
| Carta-convite | DOCX escolhido pelo Master | Não assina |
| Ata de defesa | DOCX escolhido pelo Master | Orientador |
| Termo de autorização | DOCX escolhido pelo Master | Aluno(s) e orientador, prioridade 1 |
| Declaração de participação | DOCX escolhido pelo Master | Presidente da comissão |

O programa não contém nenhum modelo documental. O Master ou o Presidente cadastra os quatro modelos em **Configurações → Modelos e Variáveis** por upload DOCX. O portal copia e renomeia o ativo para `MODELO_ATIVO_CONVITE`, `MODELO_ATIVO_ATA`, `MODELO_ATIVO_TERMO` ou `MODELO_ATIVO_DECLARACAO`. Ao substituir, a versão anterior recebe prefixo `HISTORICO`, data e hora e é movida para `01_HISTORICO_MODELOS`. O PDF normativo de referência permanece em `references/NORMAS_TCC_2021.pdf`, pois é norma e não modelo operacional. A importação de arquivo preexistente por link é opcional, fica oculta por padrão e só deve ser ativada com `GOOGLE_ALLOW_EXISTING_MODEL_LINKS=true` após aceitar o escopo adicional `drive.readonly` e refazer a autorização Google.

Ao publicar, o portal registra a revisão do Drive e o SHA-256 canônico do DOCX. A geração confirma esses dados antes e depois da conversão. Se alguém editar diretamente o arquivo ativo no Drive, a etapa é bloqueada até o Master importá-lo ou publicá-lo novamente; assim, o documento jurídico nunca muda silenciosamente durante um processo.

## Estrutura criada

| Conteúdo | Caminho dentro da pasta raiz privada |
|---|---|
| Convites gerados | `Documentos/Convite/{PROTOCOLO}/Gerados` |
| Atas geradas e assinadas | `Documentos/Ata/{PROTOCOLO}/{Gerados ou Assinados}` |
| Termos gerados e assinados | `Documentos/Termo de autorização/{PROTOCOLO}/{Gerados ou Assinados}` |
| Declarações geradas e assinadas | `Documentos/Declaração/{PROTOCOLO}/{Gerados ou Assinados}` |
| Modelos ativos e históricos | `01_DOCUMENTOS`, em subpastas por tipo de modelo |
| Trabalho completo, resumo e formulários | `02_PROCESSOS/{ANO}/{PROTOCOLO}`, em subpastas por tipo de artefato |
| Memória e estatísticas | `00_SISTEMA/01_INTELIGENCIA_CONTINUA` |

A RC8 cria os documentos nas pastas por tipo solicitadas pela secretaria. Arquivos de versões anteriores não são movidos automaticamente; seus IDs continuam válidos. O comprovante opcional da reserva fica na subpasta privada `09_COMPROVANTE_RESERVA` do processo.

Os nomes incluem código do TCC, primeiro nome de cada autor, tipo, versão e, nos documentos de assinatura, ciclo (`GERADO` ou `ASSINADO`). O título não entra no nome do arquivo. Exemplo ilustrativo: `TCC-2026-0001__ANA_E_BRUNO__ATA__v1__ASSINADO.pdf`; a normalização de separadores é feita pelo organizador. O nome completo continua dentro do documento e do cadastro.

## Variáveis oficiais reconhecidas

O motor aceita `<<Variável>>`, `{{VARIAVEL}}`, `[[VARIAVEL]]` e `«VARIAVEL»`. Principais nomes:

- `<<Alunos>>`, `<<Título do Trabalho>>`, `<<Orientador (1)>>`, `<<Examinador (2)>>`, `<<Examinador (3)>>`.
- Chaves canônicas individuais: `ORIENTADOR_SIAPE`, `COORIENTADOR_SIAPE`, `COORIENTADOR_INSTITUICAO` e, para os dois avaliadores, `EXAMINADOR_2_*` e `EXAMINADOR_3_*` com sufixos `NOME`, `EMAIL`, `SIAPE` e `INSTITUICAO`.
- `<<Data do Preenchimento>>`, `<<Data da Defesa (por extenso total)>>`, `<<Hora de Início da Defesa (por extenso)>>`, `<<Local da Defesa>>`.
- `<<Situação>>` e `<<Parecer>>` — o parecer contém somente o texto do orientador; a abertura e o encerramento da ata ficam no modelo.
- `<<Publicar Trabalho Completo>>`, `<<Publicar Resumo Expandido>>`, `<<Palavras-chave>>` e `<<Resumo Sintético>>`.
- `<<VALIDACAO_CODIGO>>` e `<<VALIDACAO_URL>>` — código e endereço público de autenticidade para impressão ou QR do próprio modelo.

Os quatro slots **Modelos documentais do usuário Master** são a única fonte dos DOCX operacionais. O Estúdio administra e-mails, formulários e a matriz de variáveis vinculada a esses documentos. A ausência do DOCX correspondente ou variáveis não resolvidas bloqueia a etapa para impedir documentos incompletos.

## Dados que movem o fluxo

Cada pergunta de formulário define uma chave canônica. O mapa de linhagem mostra sua origem e os locais de utilização; não é necessário cadastrar novamente a mesma pergunta na matriz. Essa chave pode reaparecer em DOCX, assunto/corpo de e-mail e condições das ações sem solicitar o mesmo dado novamente. O Master pode definir visibilidade condicional e validação por campo. Quando um formulário publicado é enviado, o servidor registra a revisão usada, gera sua cópia PDF e emite `FORM_<ID_DO_FORMULARIO>_SUBMITTED`; esse evento pode iniciar a próxima etapa configurada.

Renomear, mesclar ou excluir uma variável exige revisar todos os locais de uso. O validador de publicação bloqueia chave desconhecida, regra apontando para campo futuro e referência de fluxo inexistente.

## Destinatários e HTML de e-mail

Respostas livres de formulário podem preencher assunto e corpo, mas nunca controlam destinatários. Os campos **Para**, **CC** e **CCO** aceitam somente variáveis canônicas calculadas pelo processo, como aluno, orientador, banca, participantes ou ator autenticado. Todo valor dinâmico inserido em HTML é escapado; apenas a marcação estática publicada pelo Master é preservada.

Antes de publicar um e-mail, use a prévia para conferir assunto, destinatários, anexos e variáveis. O servidor repete essas validações no momento do envio; uma configuração antiga ou adulterada não contorna a regra.

## Apresentações por documento ou e-mail

Em **Oficina → Mapeamento**, selecione o artefato, informe o marcador sem delimitadores, escolha a origem e defina formato de data/hora, caixa e negrito documental. Use uma origem `DEFESA_DATA_HORA` para todas as representações da mesma data. Um mapeamento pertence apenas ao artefato selecionado. A prévia estrutural usa dados fictícios e não comprova fidelidade gráfica. Na etapa **Conferir o PDF real do modelo**, a RC8 faz a cópia temporária, mescla os valores fictícios, converte pelo Google e devolve uma amostra com marca d'água. Essa conferência não envia e-mail, não abre envelope Asten e ainda exige inspeção humana página a página.

O motor de e-mail aceita os mesmos delimitadores e o legado `-CAMPO_XX-`, em uma única passagem. Texto que contenha outro marcador permanece texto; não ocorre expansão recursiva de valores enviados pelo aluno. No HTML, aplique negrito pela marcação estática do modelo.
