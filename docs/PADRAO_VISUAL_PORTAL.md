# Padrão visual e formatação - Portal TCC

Revisão 5.2 · 03/11/2026

Guia da identidade visual aplicada ao Portal TCC do Curso de Graduação em Enfermagem e Obstetrícia da Universidade Federal do Espírito Santo. Substitui as orientações visuais conflitantes das revisões anteriores. A referência é a implementação local atual; este documento não comprova publicação na Vercel ou atualização de arquivos já arquivados no Drive.

## 1. Identidade e paleta

A logomarca COLENF identifica os cabeçalhos institucionais, o acesso, os e-mails e os registros em PDF gerados pelo Portal. Usar a imagem original, com proporção preservada e fundo transparente. Não acrescentar um retângulo preto, distorcer, cortar ou substituir por imagem ilustrativa.

A imagem utilizada pela interface é public/colenf-logo.png. Os geradores do servidor usam server/documents/assets/colenf-logo.png, com conteúdo idêntico. Configurações de identidade da instalação continuam sendo respeitadas. A marca institucional não substitui os ícones funcionais dos botões nem deve ser repetida em cada campo. O rodapé de contatos não repete a logomarca acima dos responsáveis.

As superfícies seguem esta hierarquia: página e janela branco-gelo #F6F7F8; painel cinza-claro #E9EDEF; grupo interno cinza médio #D8DFE3; campos e conteúdo branco #FFFFFF. Na planilha compacta dos membros, o cabeçalho é cinza #B7C1C8 e o corpo usa #C4CED4, com conteúdo centralizado.

Verde institucional #005830: cabeçalhos, identidade e ações principais indicadas pelo componente. Verde de ação #337959: variações de ação, foco e passagem do ponteiro. Sálvia #8CB1A3: controles secundários, visualização e escolhas de publicação selecionadas. Texto principal #0F172A; secundário #526273; borda #C4CED4. Sidebar e rodapé usam #011F17. Master e Presidente têm identificação vermelha junto ao sino; esse destaque de papel não altera as permissões.

Instruções e observações usam amarelo suave #FFFBEB, borda #FCD34D e texto #451A03. Usar título Orientações, tópicos curtos e uma ação por item. Erros, alertas de impacto e estados de sucesso mantêm sua semântica própria. Uma instrução não deve parecer um campo editável.

## 2. Controles, tabelas e janelas

Botões de ação têm formato de cápsula, com raio 9999 px, rótulo curto e ícone funcional quando útil. Ações principais usam verde; secundárias usam sálvia ou branco conforme o contexto. Ações indisponíveis ficam neutras e não respondem ao clique. Abas de navegação mantêm o formato de fichário; não viram cápsulas. Os cartões de etapas em Configurações > Fluxos e os atalhos Google Maps, Waze e Mapa da UFES usam retângulos compactos com raio de 8 px.

A geometria das planilhas segue os tokens compartilhados. Os valores abaixo são alturas de faixas ou controles, não tamanhos de fonte.

| Elemento | Medida | Aplicação |
| --- | --- | --- |
| Faixa do título | 45 px | Nome da listagem e ações |
| Faixa de filtros | 45 px | Filtros e contagens |
| Cabeçalho de colunas | 35 px | Rótulos e controles |
| Linha de dados | Mínimo de 30 px | Conteúdo compacto |
| Paginação | 24 px | Navegação entre páginas |
| Separadores | 5 px e 15 px | Respiro entre faixas |
| Controle de coluna | 15 px | Filtro e ordenação |

Listagens compartilham anatomia, bordas, densidade, rolagem e colunas fixas. Títulos usam 18 px, navegação 14 px e conteúdo compacto 11 px. Estado vazio permanece dentro da tabela. Não acrescentar uma moldura sem função entre o pop-up e a planilha. A busca filtra enquanto a pessoa digita, sem botão OK.

Dados dos membros usam cabeçalho único e uma linha por pessoa: função, nome, referência, titulação, e-mail, registro e instituição. Usar Aluno autor e Examinador sem numeração visível; o coorientador, quando presente, fica ao final. A conferência final do cadastro também usa planilhas compactas, com e-mail e registro em colunas separadas. Avisos de dados repetidos ficam em amarelo, com campo e problema descritos em linguagem comum, sem nomes internos de variáveis.

A coluna Resumo do TCC mostra um acionador compacto. O resumo abre em balão ao passar o ponteiro, receber foco ou clicar; não ocupa uma célula extensa. Em telas estreitas, manter rolagem, nomes acessíveis e leitura completa do balão.

Janelas têm cabeçalho verde com título e ícone, superfícies neutras e conteúdo compacto. O ícone acompanha o título na mesma linha. Foco de teclado, nomes acessíveis e fechamento devem funcionar. Durante um envio, usar aviso de processamento compacto e impedir submissão duplicada; encerrar o carregamento no sucesso ou na falha. Respeitar a preferência de movimento reduzido.

## 3. Detalhes do TCC e instruções

As abas seguem a ordem: Dados do processo; Conceito e Ata; Repositório acadêmico; Documentos administrativos. Links de e-mail abrem a aba correspondente à atividade. O processo legado usa as mesmas abas e componentes; seu código aparece como 001 - Legado. Dados ou arquivos antigos ausentes ficam identificados como não informados ou não disponíveis, sem inventar informações nem criar um modelo de tela separado.

A tela pública reutiliza a estrutura de detalhes em modo de leitura. Abrir um TCC no calendário ou no repositório não exige login para consultar conteúdo público. E-mails, matrículas, SIAPE, edição e arquivos privados permanecem protegidos. A disponibilidade é decidida pelo servidor; o acesso autenticado também depende do vínculo ou papel autorizado.

O aviso Antes de solicitar o agendamento aparece somente na última etapa do cadastro, antes de Reserva do local. Explicar que auditório e sala de reuniões também recebem aulas e outras atividades. Recomendar a conferência de mapa de salas, eventos, reservas e horários do prédio; a consulta ao departamento, se necessária, evita retrabalho e não é uma obrigação adicional.

O aluno escolhe um único local. Auditório e sala de reuniões dependem da homologação do departamento. Outro local, escrito como deve aparecer nos documentos, é confirmado pelo orientador. O pedido bloqueia o local por 1h30 no intervalo da defesa; o aceite mantém a reserva e a recusa libera o horário. O Portal não controla agendamentos externos.

Data, horário e local permanecem em leitura nos detalhes. Alterar reserva abre o pedido de mudança; após recusa, Solicitar nova data indica o caminho. Protocolo e data de criação são definidos pelo sistema e nunca editados. Campos bloqueados usam cinza claro e não mostram acionadores de edição.

Em Conceito e Ata, registrar conceito e parecer e conferir a ata. Os conceitos são Aprovado, Aprovado com ressalva e Reprovado. A avaliação acadêmica e a nota são lançadas no Portal do Professor; este Portal registra o conceito e a documentação. A confirmação leva a Documentos administrativos, sem disparar assinatura automaticamente. O botão Reabrir avaliação fica disponível apenas aos responsáveis permitidos e enquanto a etapa seguinte não estiver consolidada.

No Repositório acadêmico, resumo, palavras-chave e PDF do TCC são obrigatórios; publicar é opcional e independente para trabalho e resumo expandido. Antes da entrega, mostrar o botão centralizado Confirmar entrega e ir para documentos, em verde musgo. Após confirmar, campos ficam bloqueados e o botão passa a Editar entrega, em sálvia, enquanto a etapa admitir correção. Não acrescentar caixa externa ou rótulo redundante. A conclusão dos documentos encerra essa edição.

Documentos administrativos reúne cinco caixas na mesma linha em telas largas: comprovante de reserva, carta-convite, ata, termo e declaração. Em telas estreitas, reorganizar sem esconder conteúdo. Usar as mesmas caixas para legados, inclusive quando um arquivo estiver ausente. Assinatura é solicitada somente nesta área ou na gestão autorizada de declarações. Preferir: Prefira o Asten para assinar; siga o link recebido por e-mail. Pelo Gov.br, baixar, assinar e devolver o PDF. Só indicar assinatura concluída após confirmação e arquivamento.

## 4. Documentos e e-mails

PDFs de registros usam a logomarca original, cabeçalho verde com instituição e curso centralizados, título legível, seções compactas, fontes incorporadas e paginação. Nomes e registros são campos separados. Datas e horas usam formato legível; nos comprovantes e convites, preferir data numérica e horário de início e fim. Não exibir timestamps técnicos nem códigos como ALUNO_1_NOME.

Cadastro inicial: seções de trabalho, autores, orientador, coorientador, avaliadores e agendamento. Exibir segundo autor e coorientador somente quando presentes. Confirmação de local: resultado destacado, identificação do trabalho, data, horário, local e registro da resposta. Resultado negativo deve indicar indisponibilidade, sem simular confirmação.

Os quatro modelos administrativos continuam vinculados às versões publicadas pelo Master: carta-convite, ata, termo e declaração. O comprovante de reserva completa o conjunto de cinco documentos da tela. Não alterar bytes de documentos já assinados para acrescentar marca ou reformatação. Brasão e conteúdo do modelo aprovado são preservados.

Na ata, texto fixo do corpo em peso normal e dados preenchidos em negrito. Usar margens laterais compactas e numeração contínua de todas as linhas, incluindo linhas em branco, cabeçalho e rodapé. Prefixos acadêmicos são abreviados. Data final alinhada à direita, sem hora. Cada aluno tem bloco próprio de nome e identificação Aluno autor ou Aluna autora, na ordem do cadastro, com um intervalo entre blocos. Examinadores não recebem números. O coorientador, quando houver, aparece ao final no texto e nos blocos do modelo. A assinatura eletrônica da ata continua exclusiva do orientador, presidente da sessão.

O termo só é gerado quando há autorização de alguma publicação. Cada opção usa marcação grande e inequívoca e texto que distingue autorização e recusa. Todos os autores e o orientador assinam o mesmo termo. No Gov.br, o orientador reúne as assinaturas e devolve o PDF. Na declaração, coorientador e data seguem a formatação do modelo: cargo em peso normal e data à direita.

E-mails usam estrutura em tabela e estilos em linha compatíveis com Gmail: faixa verde, logo original e curso centralizados; texto objetivo e botões centralizados. Documentos são consultados pelos links da etapa. Observações ficam juntas em uma caixa amarela, com papéis e itens claros. Não repetir o mesmo pedido em caixas separadas.

Mensagens de mesmo conteúdo agrupam os destinatários. O convite reúne examinadores e coorientador, quando houver, em um envio formal iniciado por Prezados; nomes completos com tratamento e titulação vêm do processo. Os botões de aceite e recusa da reserva ficam somente na mensagem do responsável; o grupo recebe cópia informativa. O resultado e o comprovante seguem para os envolvidos sem novas confirmações redundantes. As mensagens do Asten dependem do provedor; o Portal envia a identificação completa do signatário e não controla o texto do provedor.

## 5. Fontes de verdade e conferência

A paleta e a geometria vêm de src/styles/portal-tokens.css. As regras compartilhadas estão em portal-components.css, portal-layout.css, portal-sheet.css e portal-responsive.css. Componentes e configurações publicadas completam o contrato. Não citar folhas CSS antigas como se fossem carregadas pelo Portal.

O PDF deste guia é gerado por scripts/documents/render-visual-guide.py a partir deste Markdown. A amostra de cores é lida dos tokens CSS para evitar divergência. Fonte e PDF usam a mesma revisão e data. A geração local não substitui automaticamente o PDF existente no Drive.

Conferir: logo transparente e proporcional; superfícies e cabeçalhos cinza; botões e abas com geometria correta; sálvia nas escolhas; observações amarelas em tópicos; dados compactos; cinco caixas administrativas; resumo em balão; links para a aba correta; estados coerentes; privacidade e permissões preservadas.

No cadastro, o e-mail do primeiro autor acompanha a sessão e usa campo cinza de leitura. Nomes recebem capitalização uniforme. Título e instituição aceitam sigla e/ou acrônimo entre asteriscos, como *UFES*; os indicadores não aparecem nos documentos. Rascunhos são salvos na navegação entre etapas ou por ação explícita, sem barra de espera a cada tecla. Sugestões de preenchimento não impedem digitar dados diferentes.

O conteúdo legado fica no mesmo repositório, com código próprio e os arquivos realmente localizados. A disponibilidade pública de cada arquivo segue a autorização registrada; importar um arquivo não o torna público. O Drive guarda os arquivos; o Supabase guarda os registros e referências. Documentos assinados, ausências e origem histórica não devem ser disfarçados por um estado visual de sucesso.

Validar o PDF renderizado, especialmente quebras de página, nomes longos, rodapés e contraste. Executar TypeScript, build e os testes afetados. Alterações visuais não comprovam integração real com Google, Asten ou Supabase.

Publicação na Vercel e atualização de documentos no Drive são operações separadas do trabalho local. Registrar o ambiente efetivamente conferido. Este guia não altera permissões, contratos externos, pastas ou políticas de exclusão.
