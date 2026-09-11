# Entregas da rodada RC8

Esta rodada fecha as dez melhorias aprovadas com prioridade no motor configurável `formulário → variáveis → DOCX → PDF → e-mail ou Asten → Drive → próxima etapa`. A instalação continua sendo de um único curso; a reutilização por outra secretaria ocorre por uma nova implantação independente.

| Melhoria aprovada | Entrega concreta | Proteção ou limite |
|---|---|---|
| 1. Rascunho durável do cadastro | Salvamento automático no servidor, versão otimista, recuperação após sair e validade configurável | Privado por aluno; mudança de formulário exige revisão antes do envio |
| 2. Confirmação documentada da reserva | Declaração explícita do aluno, local confirmado, ator/data e PDF comprobatório opcional no Drive | Convite bloqueado até a confirmação; o portal não lê nem presume a resposta do departamento |
| 3. Amostra real do modelo | Cópia temporária do DOCX, mesclagem fictícia, conversão Google, marca d'água e análise do PDF | Sem destinatários, assinatura ou valor documental; Google real precisa ser homologado |
| 4. Comparação antes de publicar | Diferenças entre rascunho e revisão publicada para formulários, documentos, e-mails, fluxo e aparência, com contagem de TCCs ativos | Nenhuma alteração afeta o publicado até a ação consciente do Master |
| 5. Central única de andamento | Filas de fluxo, formulário, Gmail, Asten e Drive; ações concluídas preservadas e retomadas com revisão | Resultado Asten incerto exige reconciliação; não cria envelope duplicado |
| 6. Regressão visual aprovada | Capturas em quatro larguras e alto contraste, comparação por pixel e linha de base identificada por revisor | Linha de base nunca é autoaprovada; navegador e revisão humana são obrigatórios |
| 7. Prazos e lembretes | Calendário útil, feriados/recessos, prazo por marco, intervalo e máximo por destinatário | Só usa e-mail sem anexo publicado; rotina diária limitada e idempotente |
| 8. Controle de qualidade do PDF | Marcadores pendentes, páginas vazias, estouro de página e reserva inferior para assinatura | Análise automática auxilia; não substitui a conferência visual nem a assinatura real |
| 9. Conferência de identidade | Alertas de nome, matrícula, SIAPE e possível duplicidade no cadastro | Apenas sugere revisão; nunca corrige identidade automaticamente |
| 10. Relatório institucional aprofundado | PDF agregado com período, comparação, quantidades, temas, áreas, tipos, finalidades, gráficos, tempos, qualidade e metodologia | Sem nomes, e-mails, matrículas, títulos ou resumos; categorias pequenas são protegidas |

Também foram reforçadas as invariantes do processo: campos protegidos não podem ser alterados pelo `PATCH` genérico; a avaliação formal usa rota própria e justificativa para reabertura; documentos emitidos travam alterações tardias; somente arquivos assinados e arquivados contam como concluídos; uma configuração inválida de prazos aparece como erro administrativo sem derrubar a Central.

## O que o Master realmente controla

- identidade visual global dentro dos limites de contraste e consistência;
- cadastro inicial, formulários adicionais, campos, condições e validações;
- quatro modelos DOCX externos e os marcadores de cada artefato;
- apresentação das variáveis: data, hora, data por extenso, caixa e negrito;
- textos, HTML estático, destinatários canônicos e anexos dos e-mails;
- ordem das ações em cada evento e eventos de formulários personalizados;
- prazos, calendário útil, feriados, lembretes, catálogos e relatórios.

Os marcos jurídicos e de segurança continuam protegidos pelo servidor: local antes do convite, Ata assinada antes da entrega, Termo somente quando houver publicação, autores e orientador no Termo, Presidente na Declaração e conclusão somente após arquivamento dos documentos aplicáveis.

