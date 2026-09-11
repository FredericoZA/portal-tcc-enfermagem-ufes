# Fluxo vigente — RC9

Esta versão incorpora a confirmação da reserva declarada pelo próprio aluno, conforme a orientação mais recente do proprietário. Não existe exigência de login ou aprovação do departamento dentro do portal.

| Etapa | Responsável | Entrada e condição para avançar |
|---|---|---|
| Autorização | Master ou Presidente | Aluno liberado na lista; acesso por código de e-mail |
| Cadastro inicial | Aluno | Autores e matrículas, orientação, coorientação opcional, banca, título, data, horário e local; formulário publicado pelo Master |
| Pedido de reserva | Sistema | Arquiva o cadastro e envia a solicitação ao e-mail do departamento; uma falha mantém a pendência visível |
| Confirmação recebida | Aluno | Retoma o processo, escolhe o local autorizado e declara a confirmação; registra responsável e data, com comprovante opcional |
| Convite | Sistema | Preenche o DOCX do Master, gera o PDF, arquiva e envia aos destinatários; sem assinatura |
| Avaliação | Orientador | A partir do horário da defesa: confere os dados, confirma, informa nota de 0 a 10, resultado e parecer |
| Ata | Sistema e orientador | Preenche o DOCX com dados e avaliação; encaminha à Asten para assinatura do orientador |
| Entrega final | Aluno | Após Ata assinada e arquivada, entrega o trabalho, resumo e cinco palavras-chave; informa escolhas de publicação |
| Termo de publicação | Alunos e orientador | Gerado do DOCX somente quando houver publicação; todos os autores e orientador assinam em paralelo |
| Declaração | Presidente | Gerada do DOCX após Ata e Termo aplicável assinados e arquivados; assinatura do Presidente |
| Conclusão | Sistema | Exige retorno e arquivo dos PDFs assinados; aplica as escolhas de publicação e o fluxo final configurado |

## Formulário do orientador

O formulário dedicado usa as perguntas publicadas em `form-parecer-banca`. Resultado, nota e parecer são essenciais. A confirmação dos dados é obrigatória e registra uma cópia das informações conferidas. Campos adicionais publicados são validados e conservados para documentos posteriores.

A API valida `dataConfirmed`, `expectedDataRevision` e `expectedSchemaRevision`; o navegador não consegue dispensar essas verificações. Valores vazios, fora de 0–10, com mais de duas casas decimais ou malformados são recusados. Resultado é validado contra as opções publicadas. A API recusa nova avaliação de uma etapa já concluída; a correção exige reabertura administrativa formal.

`NOTA_FINAL`, `NOTA`, `AVALIACAO_NOTA` e `CAMPO_10` representam a nota registrada. `PARECER`, `RESULTADO` e os campos aceitos alimentam o preenchimento. Respostas livres não substituem identidade, destinatários, signatários ou decisão canônica de publicação. As regras de apresentação dos marcadores continuam no painel do Master.

O cadastro do orientador não edita silenciosamente os dados já usados nos documentos. Se a conferência identificar um erro, a secretaria deve fazer a correção formal antes de nova avaliação. A versão conferida é preservada no histórico.

## Aparência compartilhada

A configuração visual usa `portalAppearance.schemaVersion = 4`, com `globalPopupStyle` persistido no servidor. A normalização remove exceções visuais antigas, sem apagar colunas, filtros, rótulos ou textos. Os controles de desvinculação foram retirados. Mensagens, confirmações e pedidos de texto usam o mesmo diálogo visual do portal.

As alterações do Master aparecem localmente no editor; a publicação as grava para outros usuários. Outro navegador recebe a versão publicada ao entrar ou recarregar. Não há promessa de atualização automática de sessões já abertas sem recarga. O DOCX oficial mantém a formatação do arquivo fornecido pelo Master; mudar a interface não altera a redação nem o desenho desses documentos.

## Falhas e recuperação

Uma avaliação pode ser salva com resposta HTTP 202 quando o arquivamento ou a geração da ata estiver pendente. A tela comunica essa condição. Não reapresente a avaliação para tentar enviar outra ata: use a Central de Andamento e a retomada administrativa existente. O processo só avança quando as dependências reais terminam.

As pastas do Drive, versionamento de modelos, retomadas, prazos, entrega final e controles de publicação da RC8 permanecem aplicáveis quando não conflitarem com este documento. Consulte `HOMOLOGACAO_RC9.md` para os testes externos necessários.
