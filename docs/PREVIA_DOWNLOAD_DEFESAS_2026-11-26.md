# Download da Lista de Defesas — prévia para aprovação

Status em 26/11/2026: prévia aprovada explicitamente pelo usuário, que autorizou
a publicação junto da nova seção Melhoria contínua no menu lateral. Esta entrega
passa pelos gates de contribuição/release antes da publicação. A confirmação
operacional depende do recibo da implantação e da verificação do site publicado.
Base: `c85ffb577a01eb1a551cc5380ca0b2ea5aa2b594`.

## Comportamento

Na lista de defesas abaixo do calendário, um botão com ícone de download acompanha
a lupa e a engrenagem, com o mesmo tamanho e estilo. Abre as opções Excel (.xlsx),
CSV (.csv) e PDF (.pdf), com a contagem de registros e colunas.

O arquivo preserva as colunas exibidas, seus rótulos e ordem, a classificação dos
registros e todos os filtros da tabela, incluindo os menus de cada coluna.
Inclui todas as páginas dos resultados filtrados. A engrenagem existente continua
responsável por escolher e reordenar as colunas; o processo permanece fixo segundo
a regra atual do Portal. O botão anterior de PDF de reservas confirmadas permanece.

A captura usa exclusivamente a tabela já autorizada e renderizada, sem buscar
cadastros, e-mails, arquivos ou dados adicionais. Colunas ocultas, controles da
interface e registros filtrados não entram no arquivo. O ícone de resumo representa
o texto de resumo já disponível para a mesma lista.

No menu lateral, Melhoria contínua reúne Enviar sugestão e Replicar portal, nessa
ordem, abaixo das demais seções. O grupo usa o estilo do Portal, permanece dentro
da navegação rolável e preserva os mesmos destinos e permissões. O guia ilustrado
foi atualizado para indicar esse caminho. Essas mudanças não exigem migração de
banco ou alteração dos registros no Supabase.

Excel é um arquivo OOXML real, com células textuais, cabeçalho congelado,
autofiltro, quebras de texto e larguras/cores da tabela. CSV contém os mesmos dados,
com BOM UTF-8, ponto e vírgula e proteção contra fórmulas; esse formato não armazena
estilos. O PDF usa fontes locais Noto Sans, cabeçalhos repetidos e paginação,
em paisagem A4 até sete colunas ou A3 para tabelas mais largas. Textos longos
continuam nas páginas seguintes sem descarte silencioso.

## Validação realizada

- TypeScript, build de produção, verificação estática de acessibilidade e scanner
  de segredos aprovados.
- 14 testes de geração/captura/interações e 14 contratos existentes de planilha,
  geometria e ícones aprovados.
- Prévia isolada com dados fictícios, componentes reais de busca, engrenagem e
  download, CSS e runtime de planilha reais; fontes e dependências embutidas.
- Downloads reais de XLSX, CSV e PDF pela interface da prévia, seguidos de abertura
  independente dos arquivos. XLSX inicial: seis registros/seis colunas; versão
  personalizada: três registros/cinco colunas, com Aluno 1 antes de Título.
- Filtro por orientador e ordenação decrescente por aluno confirmados no CSV:
  duas linhas na mesma ordem observada na tabela.
- PDF conferido visualmente. Testes de PDF também verificam acentos, texto longo,
  paginação, cabeçalhos e limites da página. XLSX aberto com openpyxl.

Esta validação da prévia não afirma homologação de uma versão publicada.
Antes de publicar, executar os gates de contribuição/release previstos pelo
projeto e confirmar a implantação do commit aprovado no domínio de produção.
