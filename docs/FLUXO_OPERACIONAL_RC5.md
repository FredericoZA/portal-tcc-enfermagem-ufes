> Histórico RC5. A sequência vigente está em [FLUXO_OPERACIONAL_RC8.md](./FLUXO_OPERACIONAL_RC8.md), que substitui este procedimento.

# Fluxo operacional RC5

## Regra principal

O usuário Master publica em **Configurações** uma versão única que liga perguntas, variáveis, documentos, e-mails e etapas. O servidor executa essa versão; o navegador não concede papéis, não escolhe signatários e não recebe credenciais externas.

## Sequência padrão da Enfermagem

1. **Liberação do aluno.** Master ou Presidente cadastra nome e e-mail na lista prévia. O aluno entra por código de uso único enviado ao e-mail autorizado.
2. **Cadastro único.** O aluno cria seu único TCC de graduação, individual ou em dupla, e informa título, matrícula(s), orientador, coorientador, banca, data e horário pretendidos. Todos os participantes são autorizados automaticamente somente para esse processo.
3. **Confirmação do local.** O local permanece pendente até o aluno registrar a autorização do Departamento de Enfermagem. Depois da confirmação, o calendário é atualizado.
4. **Convite.** O portal copia o modelo ativo de Carta-convite, substitui as variáveis, exporta PDF, arquiva no Drive e envia pelo Gmail. O convite não passa pela Asten.
5. **Defesa e avaliação.** O orientador registra `Aprovado`, `Aprovado com ressalva` ou `Reprovado` e escreve apenas o parágrafo variável do parecer. O portal gera a Ata pelo DOCX ativo e a envia à Asten para assinatura do orientador.
6. **Entrega final.** O aluno envia o trabalho em PDF, cinco palavras-chave e resumo sintético. O resumo expandido é opcional. O aluno decide separadamente se torna público o trabalho completo e/ou o resumo expandido.
7. **Documentos finais.** A Declaração é enviada pela Asten ao Presidente. O Termo existe somente quando há pedido de publicação; aluno(s) e orientador assinam em paralelo, todos na prioridade 1.
8. **Conclusão.** O processo é concluído somente quando todos os documentos aplicáveis retornam assinados e são arquivados no Drive. Só então o Gmail envia os documentos assinados aos participantes.

## Modelos de referência recebidos

Os quatro arquivos recebidos foram usados apenas para conferir os marcadores e o comportamento esperado. Eles não ficam embutidos no programa. O Master cadastra as versões oficiais nos slots:

| Slot | Marcadores exemplificados | Assinatura |
|---|---|---|
| Carta-convite | `<<Alunos>>`, `<<Título do Trabalho>>`, `<<Orientador (1)>>`, examinadores, data, hora e local | Não assina |
| Ata | alunos, título, orientador, examinadores, `<<Situação>>` e `<<Parecer>>` | Orientador |
| Termo | alunos, título, orientador, data e decisões de publicação | Aluno(s) e orientador, prioridade 1 |
| Declaração | alunos, título, orientador, examinadores e data | Presidente da Comissão |

## Garantias de execução

- Cada ação possui chave idempotente por processo, evento, revisão e artefato.
- Um erro de Drive, Gmail ou Asten deixa a execução como falha parcial e disponível para nova tentativa; não avança silenciosamente.
- E-mails com Ata, Termo ou Declaração só podem ser publicados no evento `PROCESS_COMPLETED`.
- O DOCX ativo é a fonte da diagramação. O portal substitui apenas marcadores, exporta o PDF e remove a cópia temporária.
- Arquivos privados são entregues pelo servidor somente a participantes ativos do processo ou aos dois administradores globais.
- O repositório anônimo expõe somente artefatos de processo concluído e expressamente autorizados pelo aluno.

## Referências históricas

- Página do fluxo anterior: <https://enfermagem.vitoria.ufes.br/pt-br/envio-do-trabalho-de-conclusao-de-curso>
- Norma acadêmica fornecida: `references/NORMAS_TCC_2021.pdf`

Essas referências orientam a configuração inicial, mas não substituem a versão publicada do fluxo no Estúdio.
