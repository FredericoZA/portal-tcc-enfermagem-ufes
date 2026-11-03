# TCCs legados no repositório existente — conferência de 02/11/2026

## Resultado

| Item | Quantidade |
| --- | ---: |
| Linhas da planilha completa | 99 |
| Linhas da página do curso | 95 |
| Trabalhos distintos consolidados | 97 |
| PDFs originais na pasta fornecida | 51 |
| PDF adicional recuperado da página UFES | 1 |
| PDFs distintos associados | 49 |
| Trabalhos completos associados | 34 |
| Resumos expandidos associados | 15 |
| Trabalhos sem PDF correspondente | 48 |

Os 97 trabalhos aparecem na mesma lista do **Repositório & Acervo Digital** e
abrem na tela de detalhes existente. A apresentação separada de histórico foi
removida. Identificadores: **Legado 001 a Legado 097**, independentes dos protocolos dos
processos novos. A importação não cria avaliação, matrícula, assinatura,
reserva, e-mail ou execução de fluxo. Dados ausentes não foram inventados.

## Fontes e reconciliação

- [Página de trabalhos defendidos do curso](https://enfermagem.vitoria.ufes.br/pt-br/trabalhos-de-conclusao-de-curso-defendidos).
- [Planilha completa publicada pelo usuário](https://docs.google.com/spreadsheets/d/e/2PACX-1vQucIwgv0TbpZzsFIqGvaCh7meVsKRZtF8o17sBNh604utu_cY3m4syMp7jao69-LNIBaxZzS8IcriE/pubhtml).
- Pasta privada “Trabalhos”, indicada pelo usuário. O inventário com IDs
  privados permanece em `.portal-data/legacy-import/`, fora do Git.

Isadora Bianchi Daré tinha duas submissões do mesmo trabalho. Eduarda
Cerqueira de Lemos Pessanha e Isabela Oliveira Matias tinham registros
separados do mesmo trabalho; ambas as autoras foram preservadas.
A data inválida `21/02/20225` da página foi corrigida usando `21/02/2025`
da planilha.

Dois hiperlinks da página apontavam para conteúdos de outros trabalhos.
A associação foi conferida pelo texto dos PDFs. Um resumo público ausente do Drive foi recuperado nesta reconferência e
associado ao Legado 029 (Mariana Passagem Torres), após comparação do texto
com o resumo da planilha. Embora estivesse vinculado ao Legado 030 na página
da UFES, o conteúdo corresponde ao Legado 029. A cópia enviada ao Drive teve
o SHA-256 conferido por um novo download.
Três cópias repetidas foram reconhecidas pelo SHA-256 do conteúdo e enviadas
à lixeira recuperável do Drive. As cópias canônicas foram preservadas.

Os 48 PDFs distintos foram renomeados e movidos no Drive para pastas
`Trabalhos/Legado NNN`, conforme o respectivo trabalho. Os nomes seguem o
padrão de arquivo do Portal: código, autoria, título, tipo e versão. Os IDs,
conteúdos, proprietário e permissões dos PDFs canônicos foram preservados.
Não foram criadas pastas vazias para os 49 registros sem PDF.

Após a organização, uma nova cópia ZIP da pasta foi baixada pelo Drive.
Os 48 caminhos, nomes e hashes foram comparados com o inventário: todos
coincidiram, sem PDFs extras. A evidência privada está em
`.portal-data/legacy-import/drive-organization-verification.json`.

Linhas originais, hashes e critérios de associação constam da procedência
privada de cada registro. Títulos, autores, orientadores e examinadores exibidos
seguem a capitalização do Portal; os textos originais permanecem na procedência
privada. A caixa alta dos nomes de arquivo segue o padrão de arquivamento já
existente e não determina a escrita dos títulos na tela.

## Privacidade e persistência

A autorização de origem é respeitada: 48 trabalhos têm “Sim”, 47 têm “Não”
e dois têm respostas divergentes. Os divergentes (Legado 035 e Legado 072)
permanecem restritos até conferência. Dos 48 autorizados, 41 têm PDF associado
e sete ainda não têm arquivo recuperável pelas fontes fornecidas.

O legado aceita trabalhos sem PDF completo, somente com resumo expandido ou
sem arquivo. Essa exceção é exclusiva do acervo histórico, sem mudar o fluxo
obrigatório de entrega dos processos novos.

O Drive permanece privado. A API pública oferece apenas URLs do Portal para
os arquivos autorizados, sem IDs do Drive ou procedência privada. O resumo
é disponibilizado somente quando a autorização de origem é inequívoca;
respostas negativas ou divergentes mantêm o resumo e o PDF restritos.
Cada download confere o SHA-256 do conteúdo importado; troca de arquivo no
Drive não publica automaticamente outra versão. A importação e o catálogo
privado continuam exclusivos do Master.

A importação exige revisão atual do catálogo para evitar sobrescrita
concorrente; registros idênticos são ignorados e colisões são rejeitadas.
O acervo fica em uma coleção técnica independente dos processos em tramitação,
mas sua apresentação é integrada ao repositório e ao detalhe padrão. Não há
uma nova aba para o legado. Não se atribui acesso privado a uma conta apenas
pela semelhança do nome: as fontes não fornecem e-mails para esse vínculo.

## Validação executada

- Seis testes automatizados: privacidade, validação, deduplicação, capitalização,
  autenticação, permissão Master, revisão concorrente, persistência isolada, ausência do TCC completo, download
  autorizado e bloqueio de arquivos alterados ou negados.
- `npm run lint`: aprovado.
- `npm run test:secrets`: aprovado para os arquivos rastreados pelo verificador.
- `npm run build`: aprovado; avisos de tamanho de chunks permanecem.
- `npm run test:secure-flow`: 40 verificações aprovadas.
- Navegador local: mesma lista e tela de detalhes, códigos com três algarismos,
  nomes normalizados, consulta de resumo autorizado e botões de arquivo público.
  Capturas estão em `.portal-data/legacy-import/review/`.
- Downloads locais: 40 PDFs autorizados recuperados com hash idêntico e
  oito PDFs restritos bloqueados; um download também conferido pelo navegador.
- Nova verificação HTTP após a renomeação: PDF autorizado com status 200,
  nome padronizado e SHA-256 correspondente; PDF restrito com status 404.
- Leitura após importação: 97 registros, 49 referências; processos e filas
  operacionais anteriores permaneceram iguais.

## Limite da entrega

A interface e a importação dos dados foram validadas **localmente**. A organização
dos arquivos foi executada e conferida no **Drive real**. A numeração
aceita de Legado 001 até Legado 999, mantendo os IDs internos já importados. Não houve deploy,
importação no Supabase de produção ou mudança de permissão dos arquivos.
O acesso efetivo aos PDFs continua sujeito à permissão do Drive.

Quando o usuário autorizar a publicação, a ordem é: publicar o código,
conferir o ambiente, importar o inventário privado pelo Master e verificar
a leitura em produção. Não carregar o novo campo no banco enquanto o runtime
antigo estiver ativo, pois esse runtime não conhece a coleção legada.

## Reconferência dos hiperlinks da UFES

A página foi obtida novamente e seus 45 links PDF foram confrontados com o
inventário já baixado: não houve mudança nos URLs. Os 44 conteúdos acessíveis
estão agora contemplados pelos arquivos associados; o outro link continua
retornando HTTP 403. O catálogo permanece no repositório existente, sem nova
planilha ou nova tela. Não houve alteração de código nesta reconferência.

Pendências de autores com Sim na planilha: Legado 013 (Isaély Resnaroski da
Silva / Lara Cruzeiro de Abreu, link bloqueado); Legado 030 (Aymê Simões Janes,
link para o PDF de Mariana); Legado 060 (Ester Reis Almeida), Legado 061
(Esthefany Breguez de Almeida / Thalyta Machado de Souza Bellato), Legado 095
(Guilherme Germano da Silva), Legado 096 (Paula Gabriella Pedras Silva) e
Legado 097 (Milena de Oliveira Corrêa). Estes cinco últimos não possuem
hiperlink na página indicada. Nenhum arquivo diferente foi usado como substituto.

Verificação desta reconferência: 49 PDFs locais com hash correto; novo download
autorizado com HTTP 200; arquivo ausente e consentimento conflitante com HTTP
404; todas as coleções operacionais preservadas. Evidência privada em
`.portal-data/legacy-import/source-recovery-verification.json`.
