# Padrão visual e formatação - Portal TCC

Revisão 5.1 · 28/10/2026

Guia da identidade visual aplicada ao Portal TCC do Curso de Graduação em Enfermagem e Obstetrícia da Universidade Federal do Espírito Santo. Substitui as orientações visuais conflitantes das revisões anteriores. A referência é a implementação local atual; este documento não comprova publicação na Vercel ou atualização de arquivos já arquivados no Drive.

## 1. Identidade e paleta

A logomarca COLENF identifica os cabeçalhos institucionais, o acesso, os e-mails e os registros em PDF gerados pelo Portal. Usar a imagem original, com proporção preservada e fundo transparente. Não acrescentar um retângulo preto, distorcer, cortar ou substituir por imagem ilustrativa.

A imagem utilizada pela interface é public/colenf-logo.png. Os geradores do servidor usam server/documents/assets/colenf-logo.png, com conteúdo idêntico. Configurações de identidade da instalação continuam sendo respeitadas. A marca institucional não substitui os ícones funcionais dos botões nem deve ser repetida em cada campo. O rodapé de contatos não repete a logomarca acima dos responsáveis.

As quatro superfícies seguem esta hierarquia: página e janela branco-gelo #F6F7F8; painel cinza-claro #E9EDEF; grupo interno cinza médio #D8DFE3; campos e conteúdo branco #FFFFFF.

Verde institucional #005830: cabeçalhos e identidade. Verde de ação #337959: ações principais. Sálvia #8CB1A3: controles secundários, visualização e escolhas de publicação selecionadas. Texto principal #0F172A; secundário #526273; borda #C4CED4. Sidebar e rodapé usam #011F17.

Instruções e observações usam amarelo suave #FFFBEB, borda #FCD34D e texto #451A03. Erros, alertas de impacto e estados de sucesso mantêm sua semântica própria. Uma instrução não deve parecer um campo editável.

## 2. Controles, tabelas e janelas

Botões de ação têm formato de cápsula, com raio 9999 px, rótulo curto e ícone funcional quando útil. Ações principais usam verde; secundárias usam sálvia ou branco conforme o contexto. Ações indisponíveis ficam neutras e não respondem ao clique. Abas de navegação mantêm o formato de fichário; não viram cápsulas. Os cartões de etapas em Configurações > Fluxos e os atalhos Google Maps, Waze e Mapa da UFES usam retângulos compactos com raio de 8 px.

A planilha usa título de 45 px, cabeçalho de colunas de 35 px, linha de dados com mínimo de 30 px e paginação de 24 px. Com filtros, preservar os separadores de 5 px e 15 px. O controle compacto das colunas tem 15 px; não confundir com o tamanho dos botões de ação.

Listagens compartilham anatomia, bordas, densidade, rolagem e comportamento fixo das colunas. Estado vazio permanece dentro da tabela. Não acrescentar uma moldura sem função entre o pop-up e a planilha.

Dados dos membros usam colunas comuns e cabeçalho único, evitando repetir Nome, E-mail e Registro em cada bloco. Manter separação clara entre autores, orientador, coorientador e avaliadores. Em telas estreitas, preservar leitura e rótulos acessíveis.

Janelas têm cabeçalho verde com título e ícone, superfícies neutras e conteúdo compacto. Ações de fechamento continuam visíveis onde já fazem parte do fluxo. Foco de teclado, nomes acessíveis e estados de carregamento devem funcionar. Durante um envio, informar que está processando e impedir submissão duplicada.

## 3. Detalhes do TCC e instruções

As abas seguem a ordem: Dados do processo; Avaliação e ata; Repositório; Documentos do processo. Links de e-mail abrem a aba correspondente à atividade. Após concluir avaliação ou entregar arquivos que exigem assinatura, a documentação é tratada em Documentos do processo.

A tela pública reutiliza a estrutura de detalhes em modo de leitura. Não exibe e-mails, matrículas, SIAPE, ações de edição ou arquivos privados. A disponibilidade de documentos respeita a projeção pública do servidor. Login não transforma um visitante em participante autorizado.

Antes do agendamento, apresentar aviso amarelo: o orientador deve consultar o Departamento de Enfermagem sobre data, horário e local antes de formalizar o pedido. A resposta do departamento é registrada pelo formulário recebido por e-mail. A reserva ocupa 1 hora e 30 minutos no local autorizado.

No início dos dados do processo, quando aplicável: “Aguardando confirmação do departamento pelo formulário enviado por e-mail.” Não mencionar procedimentos antigos de anexação de comprovante.

Em Avaliação e ata, usar uma instrução amarela curta. Somente orientador e Master podem reabrir a avaliação. Assinatura, visualização e download ficam em Documentos do processo. Escolher Gov.br ou baixar o PDF não significa que a assinatura terminou.

No Repositório, a entrega exige confirmação explícita. Antes da entrega, mostrar somente o botão centralizado Confirmar entrega final em verde musgo. Depois, os campos ficam bloqueados e aparece somente o botão centralizado Acompanhar documentos em sálvia. Não acrescentar caixa externa, instrução redundante ou rótulo de entrega registrada. Escolhas independentes de publicação do trabalho e resumo usam sálvia. Gerar termo somente quando há publicação autorizada.

Nos locais de assinatura, preferir a instrução: “Prefira a Asten para assinar: basta seguir o link recebido por e-mail.” No Gov.br, baixar, assinar e devolver o PDF no mesmo fluxo. O termo é único, com todas as assinaturas; a devolução é responsabilidade do orientador, com acesso administrativo do Master conforme as permissões do Portal.

## 4. Documentos e e-mails

PDFs de registros usam logomarca, cabeçalho verde com instituição e curso centralizados, título legível, seções compactas, fontes incorporadas e paginação. Nomes e registros são campos separados. Datas e horas aparecem em português, sem timestamps técnicos no corpo. Rótulos devem ser humanos, sem códigos como ALUNO_1_NOME.

Cadastro inicial: seções de trabalho, autores, orientador, coorientador, avaliadores e agendamento. Exibir segundo autor e coorientador somente quando presentes. Confirmação de local: resultado destacado, identificação do trabalho, data, horário, local e registro da resposta. Resultado negativo deve indicar indisponibilidade, sem simular confirmação.

Os quatro documentos acadêmicos continuam vinculados aos modelos oficiais publicados pelo Master. Não alterar documentos já assinados para acrescentar identidade. Brasão e conteúdo oficial são preservados; qualquer nova logomarca deve caber no modelo aprovado sem disputar espaço com o texto.

Na ata, texto fixo do corpo em peso normal e dados preenchidos em negrito. Margens laterais compactas e numeração contínua das linhas seguem o modelo da ata. Prefixos acadêmicos são abreviados. Data final alinhada à direita, sem hora. Cada aluno tem seu próprio bloco de nome e identificação Aluno autor ou Aluna autora, na ordem do cadastro, com um único intervalo entre blocos.

No termo, cada opção de publicação deve ter marcação grande e inequívoca, além do texto que informa se foi autorizada. No bloco da declaração, o cargo de coorientador fica em peso normal e o nome segue o destaque das variáveis; a data fica à direita.

E-mails usam estrutura em tabela e estilos em linha compatíveis com Gmail: faixa verde, logo e nome do curso centralizados; texto objetivo; um único botão centralizado antes das instruções. Não anexar os documentos acadêmicos. O botão abre o processo ou o formulário/comprovante específico da etapa.

Saudação e instruções identificam os papéis reais: departamento, autores, orientador ou convidados da banca. Observações e instruções ficam em amarelo suave. Não repetir o mesmo pedido no início e no final. Cada mensagem explica a próxima ação, sem repetir histórico de mudanças do sistema.

## 5. Fontes de verdade e conferência

A paleta e a geometria vêm de src/styles/portal-tokens.css. As regras compartilhadas estão em portal-components.css, portal-layout.css, portal-sheet.css e portal-responsive.css. Componentes e configurações publicadas completam o contrato. Não citar folhas CSS antigas como se fossem carregadas pelo Portal.

O PDF deste guia é gerado por scripts/documents/render-visual-guide.py a partir deste Markdown. Os dois arquivos devem ser atualizados juntos. A revisão e a data devem coincidir. Arquivos novos não substituem automaticamente PDFs já arquivados no Drive.

Conferir: logo transparente e proporcional; quatro superfícies; botões arredondados; sálvia nas escolhas; observações amarelas; dados compactos; links direcionados à aba correta; estados pendente e concluído coerentes; privacidade e permissões preservadas.

Validar o PDF renderizado, especialmente quebras de página, nomes longos, rodapés e contraste. Executar TypeScript, build e os testes afetados. Alterações visuais não comprovam integração real com Google, Asten ou Supabase.

Publicação na Vercel e atualização de documentos no Drive são operações separadas do trabalho local. Registrar o ambiente efetivamente conferido. Este guia não altera permissões, contratos externos, pastas ou políticas de exclusão.
