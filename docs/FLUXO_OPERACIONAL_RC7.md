> Histórico RC7. A sequência vigente está em [FLUXO_OPERACIONAL_RC8.md](./FLUXO_OPERACIONAL_RC8.md).

# Fluxo operacional RC7 — Secretaria de Enfermagem

Esta instalação atende um curso. O Master publica o cadastro, os locais disponíveis, o destinatário do departamento, os textos de e-mail, os modelos externos e suas variáveis. A replicação do código para outra secretaria é descrita no Tutorial; não existe seleção de cursos durante o uso.

## Sequência obrigatória

| Marco | Responsável | Comportamento e condição de avanço |
|---|---|---|
| Acesso | Master / aluno | Nome e e-mail pré-autorizados; código de uso único. Um TCC como autor não impede participação em outras bancas. |
| Cadastro | Aluno | Formulário efetivamente editável no Estúdio. Nomes completos, matrículas completas, e-mails, SIAPE do orientador, dupla e coorientação opcionais, dois avaliadores, título, data/hora. |
| Reserva | Aluno / departamento | Última seção: local preferido e alternativa, definidos pelo Master. O evento `TCC_CREATED` envia o pedido ao e-mail do departamento. |
| Espera | Departamento / aluno | O aluno registra a confirmação recebida. Até esse registro o convite e as etapas seguintes permanecem bloqueados. A confirmação não é inferida de uma resposta de e-mail. |
| Convite | Fluxo do Master | `LOCATION_CONFIRMED` gera o PDF do modelo externo e o envia aos destinatários configurados. Não há assinatura. |
| Defesa | Orientador | O orientador registra a avaliação. `EVALUATION_SUBMITTED` gera a Ata e inicia sua assinatura Asten. |
| Retorno da Ata | Asten / Drive | A entrega final só aceita envio depois de a Ata retornar assinada e ser arquivada. Uma solicitação de assinatura enviada não equivale a um documento assinado. |
| Entrega final | Aluno | Exatamente cinco palavras-chave, resumo sintético com três a cinco parágrafos separados por linha em branco, PDF completo obrigatório e resumo expandido opcional. Cada PDF tem opção própria de publicação. |
| Autorização | Autores e orientador | `REPOSITORY_SUBMITTED` gera Termo apenas quando algum documento será publicado. Todos os autores e o orientador assinam em paralelo, na prioridade 1. Sem publicação, este documento é dispensado. |
| Declaração | Presidente | `PUBLICATION_CLEARED` ocorre após a Ata e o Termo aplicável estarem assinados e arquivados. A Declaração é então gerada e enviada à assinatura do Presidente. |
| Conclusão | Portal | Somente após todos os documentos aplicáveis serem assinados e arquivados: conclusão, e-mail final e disponibilização dos materiais cuja publicação foi autorizada. |

O botão de assinatura inicia o fluxo Asten configurado. A confirmação efetiva da assinatura acontece conforme a autenticação e a política da Asten; o portal não assina silenciosamente em nome de outra pessoa.

## Configurar sem programar

1. Em **Configurações → Modelos e Variáveis**, envie os quatro DOCX. A formatação base, o texto e os marcadores pertencem ao Master.
2. Na aba **Oficina**, informe o e-mail do departamento e os locais. O padrão oferece Sala de reuniões e Auditório do Departamento de Enfermagem; revise os nomes adotados na instalação.
3. Use **Editar o cadastro inicial** e a aba **Formulários** para alterar seções, rótulos, ajuda, validações, condições e perguntas adicionais. Preserve as chaves dos campos estruturais. Os dados essenciais não podem ser removidos ou convertidos em outro tipo, pois sustentam identidade, assinaturas e agenda.
4. Defina o catálogo de áreas, temas, tipos de estudo e finalidades, incluindo sinônimos e vigência. Os campos correspondentes oferecem as opções válidas. Sem catálogo, o relatório mantém a classificação desconhecida.
5. Na Oficina, selecione o documento ou e-mail, identifique o marcador sem delimitadores e escolha a variável de origem. A mesma origem pode ter várias apresentações.
6. Na aba **E-mails**, publique assunto, corpo, HTML opcional, destinatários e anexos. A conta Google conectada pelo Master é a remetente. A identidade canônica do processo define os destinatários variáveis; respostas livres só preenchem o conteúdo.
7. Na aba de fluxo, ajuste a ordem das ações dentro de cada evento. Documento anexado deve ser gerado antes do respectivo e-mail. As dependências críticas acima permanecem validadas no servidor.
8. Execute o simulador com um ou dois autores, com e sem publicação, com local pendente e com falha no convite. Confira destinatários, anexos e a prévia móvel/desktop do e-mail.
9. Publique depois de corrigir os erros do diagnóstico. Salvar um rascunho ou aprovar uma proposta de melhoria não publica o fluxo.

## Uma origem, várias apresentações

Exemplo: `DEFESA_DATA_HORA` guarda um instante; o cadastro o converte do fuso institucional, normalmente `America/Sao_Paulo`.

| Marcador no modelo | Origem | Apresentação |
|---|---|---|
| `<<DATA>>` | `DEFESA_DATA_HORA` | Data numérica |
| `<<HORA>>` | `DEFESA_DATA_HORA` | Hora numérica |
| `<<DATA_DESCRITIVA>>` | `DEFESA_DATA_HORA` | Data por extenso |
| `<<AUTORES>>` | `CAMPO_01` | Caixa alta, negrito no DOCX |

O formato é específico do artefato. Negrito aplica-se ao trecho do marcador no documento, preservando a composição restante. No HTML de e-mail, use o próprio modelo, por exemplo `<strong>{{AUTORES}}</strong>`. Valores inseridos são escapados e nunca interpretados novamente como marcadores.

## Atualização de uma instalação RC5/RC6

Faça backup antes da atualização. Ao abrir o Estúdio, a RC7 prepara um rascunho compatível: transporta a Declaração para `PUBLICATION_CLEARED`, acrescenta o pedido de reserva e reconcilia o cadastro inicial, preservando os modelos e o original publicado. Informe o endereço real do departamento, revise os campos e publique a nova revisão. A atualização do código não substitui automaticamente o fluxo em produção.

Processos antigos sem SIAPE e sem marcações específicas de tempo continuam identificáveis; os indicadores históricos permanecem desconhecidos quando não há evidência suficiente. Não invente assinaturas ou datas para preencher a migração. TCCs que já tenham documentos externos devem ser conferidos pela secretaria antes de reaplicar qualquer evento.

## Erros e retentativas

Uma falha interrompe a sequência naquele ponto. Antes de reenviar, consulte o estado do documento, a entrega do Gmail e a outbox Asten. Resultado ambíguo de criação de envelope exige reconciliação com o provedor. Falha de arquivamento de um PDF já assinado deve repetir o arquivamento, preservando a assinatura. Nenhuma retentativa libera local, avaliação ou publicação indevidamente.

Consulte `HOMOLOGACAO_RC7.md` para a prova com contas reais.
