# Fluxo operacional RC8 — Secretaria de Enfermagem

Esta instalação atende um curso. O Master define aparência, campos, modelos, e-mails e ações no Estúdio; o servidor executa somente a revisão publicada e mantém os marcos obrigatórios. Outra secretaria replica o código conforme o Tutorial e usa contas, banco, Drive, modelos e credenciais próprios.

## Sequência executável

| Ordem | Responsável | Entrada configurável | Ação e condição de avanço |
|---:|---|---|---|
| 1 | Master / Presidente | Lista de nomes e e-mails autorizados | O aluno solicita um código de uso único. Somente a autorização ativa permite criar o TCC. |
| 2 | Aluno | Cadastro publicado: autor(es), matrículas, título, orientador, SIAPE, coorientador opcional, dois avaliadores, data/hora, locais e campos adicionais | O rascunho é salvo de forma privada e versionada. Ao concluir, o servidor valida os campos e limita cada autor a um TCC de graduação. |
| 3 | Fluxo publicado | Modelo de e-mail da reserva e e-mail canônico do departamento | O evento `TCC_CREATED` arquiva o formulário e envia o pedido de reserva com local preferido e alternativa. Falha interrompe a sequência. |
| 4 | Departamento / aluno | Locais publicados pelo Master | O processo espera. O aluno registra a confirmação recebida, o local autorizado e, opcionalmente, o e-mail salvo como PDF. Até isso, não há convite. |
| 5 | Fluxo publicado | DOCX de Convite, mapeamentos, e-mail e destinatários | `LOCATION_CONFIRMED` gera o convite pelo modelo fixado por revisão e SHA-256, converte em PDF, arquiva em `Documentos/Convite/{PROTOCOLO}/Gerados` e envia o anexo. O convite não é assinado. |
| 6 | Orientador | Formulário de avaliação e modelo da Ata | Na data da defesa, o orientador registra resultado, nota e parecer. `EVALUATION_SUBMITTED` arquiva a avaliação, gera a Ata e inicia o envelope Asten do orientador. |
| 7 | Asten / Drive | Regras protegidas de assinatura | A entrega final permanece bloqueada até o callback confirmar a composição esperada, o PDF assinado ser obtido e arquivado em `Documentos/Ata/{PROTOCOLO}/Assinados`. |
| 8 | Aluno | Formulário final publicado | O aluno informa exatamente cinco palavras-chave, resumo sintético de três a cinco parágrafos, envia o trabalho completo obrigatório e o resumo expandido opcional, com decisões de publicação independentes. O trabalho completo sempre é guardado, mesmo quando privado. |
| 9 | Fluxo publicado / Asten | DOCX do Termo e escolhas de publicação | Se nenhum arquivo for público, o Termo é dispensado. Se algum for público, o Termo é gerado e enviado simultaneamente a todos os autores e ao orientador, todos na prioridade 1. |
| 10 | Presidente | DOCX da Declaração | Depois da Ata e do Termo aplicável assinados e arquivados, `PUBLICATION_CLEARED` gera a Declaração e inicia a assinatura do Presidente. |
| 11 | Portal | E-mail final publicado | O processo conclui somente após a Declaração assinada e arquivada. O e-mail final e as rotas públicas respeitam as escolhas assinadas; os demais arquivos permanecem privados. |

O botão **Assinar documento** inicia o procedimento na Asten. A assinatura digital efetiva ocorre conforme a autenticação do provedor; o portal não assina silenciosamente por outra pessoa. Um aceite de envio pelo Gmail não prova leitura, e um envelope criado não equivale a documento assinado.

## Como o Master monta uma etapa

1. Crie ou edite o formulário e atribua uma chave estável a cada resposta, por exemplo `ALUNO_1_NOME`, `TITULO` ou `DEFESA_DATA_HORA`.
2. Envie o DOCX oficial na área de Modelos. O conteúdo, a identidade visual do documento e os marcadores são do Master; o programa não fornece modelo jurídico.
3. Para cada marcador, escolha a variável de origem e sua apresentação. Uma única data pode render data numérica, hora ou data por extenso em artefatos diferentes.
4. Crie o e-mail com assunto, texto, HTML estático, destinatários canônicos e anexos. Valores de formulário podem preencher conteúdo, mas nunca inventar ou redirecionar destinatários.
5. No evento correto, ordene as ações. Se o e-mail leva um documento, a ação **Gerar documento** deve vir antes de **Enviar e-mail**.
6. Gere a amostra real do PDF no Google, confira os apontamentos automáticos e faça inspeção visual página a página.
7. Simule os papéis e os quatro cenários de publicação. Compare o rascunho com o publicado e observe quantos TCCs ativos podem ser afetados.
8. Publique somente quando o diagnóstico não tiver erro. Salvar rascunho, aprovar proposta ou editar um arquivo direto no Drive não altera o fluxo publicado.

## Variáveis e apresentações

| Necessidade no artefato | Origem única | Apresentação escolhida |
|---|---|---|
| `<<DATA_DA_DEFESA>>` | `DEFESA_DATA_HORA` | data numérica |
| `<<HORA_DA_DEFESA>>` | `DEFESA_DATA_HORA` | hora |
| `<<DATA_POR_EXTENSO>>` | `DEFESA_DATA_HORA` | data descritiva no fuso institucional |
| `<<AUTORES>>` | autores canônicos do processo | caixa alta e negrito no DOCX |
| `<<PARECER>>` | avaliação formal do orientador | texto, sem alterar a redação fixa da Ata |
| `<<PUBLICAR_TRABALHO>>` | opção protegida da entrega final | descrição publicada pelo Master |

Respostas de formulários enviados e arquivados continuam disponíveis em etapas posteriores. Identidade, autorização de publicação, destinatários, signatários e campos estruturais prevalecem sobre qualquer variável livre com o mesmo nome. Marcador restante no PDF bloqueia o artefato.

## Falhas, retomadas e prazos

- Uma ação com falha impede as ações seguintes. A Central de Andamento mostra o motivo e o que já foi preservado.
- A retomada exige autenticação administrativa recente, revisão compatível do Estúdio e dados do TCC inalterados. Ações concluídas não são repetidas.
- Resultado incerto da criação Asten é conciliado com o provedor antes de nova tentativa. Callback repetido é idempotente.
- Prazos contam somente os dias úteis publicados, descontando feriados e recessos. Na avaliação, a contagem começa na data/hora da defesa.
- Lembretes usam modelo publicado sem anexo, destinatário canônico, máximo por pessoa e registro durável. Falhas exigem revisão do Gmail antes de repetir.
- A rotina diária também remove staging expirado, vence rascunhos e atualiza os dois arquivos vivos; ela usa `CRON_SECRET` e limites de execução.

## Organização documental

Documentos oficiais ficam em `Documentos/{Convite|Ata|Termo de autorização|Declaração}/{PROTOCOLO}/{Gerados|Assinados}`. Os nomes usam código do TCC, primeiro nome dos autores, tipo, versão e ciclo. Formulários, trabalhos e comprovante da reserva ficam na pasta privada do processo. Modelos permanecem no Drive do proprietário; o ZIP não contém DOCX oficiais nem credenciais.

