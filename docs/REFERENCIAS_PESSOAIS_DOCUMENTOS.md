# Tratamento, titulação e concordância nos documentos

Implementação local em 23/10/2026. Sem publicação nesta rodada.

O cadastro solicita a forma de referência de cada autor (Aluno ou Aluna). Para
orientação, coorientação e os dois examinadores solicita Professor ou Professora,
a titulação (Doutor, Doutora, Mestre, Mestra, Especialista ou Sem titulação) e o
nome em campos separados. O nome permanece separado dos títulos nos dados.
A prévia mostra como o nome será apresentado. A ficha do processo permite
corrigir as escolhas pelas mesmas permissões, bloqueios e auditoria do cadastro.

A geração da carta-convite, ata, termo e declaração usa essas escolhas. Nomes que
já contêm títulos não recebem títulos duplicados. Não se deduz gênero pelo nome.
Registros antigos sem escolhas preservam os nomes e usam referências neutras à
autoria. A compatibilidade com clientes antigos não obriga a preencher campos
inexistentes nas antigas submissões; o cadastro atual exige as novas escolhas.

## Marcadores para os modelos

Para cada prefixo `ALUNO_1`, `ALUNO_2`, `ORIENTADOR`, `COORIENTADOR`,
`EXAMINADOR_2` e `EXAMINADOR_3` estão disponíveis:

- `<<PREFIXO_TRATAMENTO>>`: escolha declarada.
- `<<PREFIXO_TITULACAO>>`: titulação declarada, vazia para autores.
- `<<PREFIXO_NOME_COMPLETO>>`: nome docente com tratamento e titulação por extenso;
  para alunos, somente o nome completo.

Por exemplo, `<<ORIENTADOR_NOME_COMPLETO>>` produz `Professora Doutora Maria Silva`.
Não acrescente `Prof(a). Dr(a).` antes desse marcador. Os marcadores antigos de
nome da orientação e dos examinadores continuam atendidos.

Concordância da autoria:

| Marcador | Exemplo para uma aluna | Exemplo para duas alunas |
| --- | --- | --- |
| `<<ALUNOS_REFERENCIA>>` | a graduanda | as graduandas |
| `<<ALUNOS_REFERENCIA_DE>>` | da graduanda | das graduandas |
| `<<ALUNOS_REFERENCIA_POR>>` | pela graduanda | pelas graduandas |
| `<<ALUNOS_REFERENCIA_A>>` | à autora | às autoras |
| `<<ALUNOS_ROTULO>>` | Aluna | Alunas |
| `<<ALUNOS_VERBO_APRESENTAR>>` | expôs | expuseram |
| `<<RESULTADO_CONCORDANTE>>` | Aprovada | Aprovadas |

A titulação não é inferida. As variáveis derivadas dos participantes não podem
ser substituídas por valores extras enviados na execução do fluxo.

## Ata e preservação dos modelos

O encerramento usa o agendamento acrescido de uma hora, no horário de Brasília.
Exemplo: defesa às 14h, encerramento às 15h. A frase passa a ser:

> Nada mais havendo a tratar, às quinze horas foi encerrada a sessão e lavrada a
> presente ata que segue para ser assinada.

Isso é o horário documental de encerramento; o horário real registrado pelo
provedor de assinatura continua sendo o horário efetivo da assinatura.

Resultado e parecer recebem negrito e têm o sublinhado removido, inclusive em
textos distribuídos por vários trechos de formatação e pareceres com parágrafos.
As fórmulas antigas conhecidas são adequadas na cópia temporária de geração,
com alterações pontuais no texto. Cabeçalhos, imagens, tabelas e trechos não
alterados não são reconstruídos. O modelo original e PDFs já emitidos não são
sobrescritos. Redações personalizadas fora dessas fórmulas devem usar os novos
marcadores para expressar corretamente a concordância.

## Verificação

Testes cobrem uma autora, duas autoras, autoria mista, dados antigos, títulos
legados, passagem da meia-noite, obrigatoriedade no novo formulário, variáveis
protegidas, edição HTTP com autenticação, persistência e auditoria. O renderizador
Google é exercitado com um provedor simulado que aplica as requisições de edição
sobre uma cópia e confere os intervalos de negrito e remoção de sublinhado nos
quatro tipos documentais. Isso não homologa exportação real pelo Google Drive.

No navegador local foram conferidos cadastro, campos opcionais condicionais,
prévia, salvamento automático da ficha e recuperação após recarregar. Nenhum
cadastro final foi enviado para disparar e-mails ou assinaturas reais.

## Complemento — termo de autorização e ordem da autoria (rodada 63)

A pergunta **Ordem dos nomes nos documentos** aparece quando há segundo autor.
A prévia mostra os nomes na ordem escolhida, com a referência declarada pelas
pessoas. O padrão é primeiro autor seguido do segundo. A opção também pode ser
corrigida na ficha, pelas mesmas permissões e bloqueios de emissão dos documentos.
Alterar a ordem é uma apresentação: não troca autor autenticado, matrícula,
e-mail, consentimentos, permissões ou destinatários de assinatura. A mudança
fica no histórico e é persistida. Não se deduz gênero pela ordem nem pelo nome.

Há cinco variantes automáticas: individual feminino, individual masculino,
dupla feminina, dupla masculina e dupla mista. Dados antigos sem escolhas
completas usam referências neutras. Os quatro slots documentais são preservados;
não é necessário manter cinco arquivos DOCX distintos para cada documento.

Marcadores adicionais para um texto novo:

| Marcador | Uma aluna | Duas alunas |
| --- | --- | --- |
| `<<AUTORIA_PRONOME>>` | Eu | Nós |
| `<<AUTORIA_NOMES>>` | Maria | Ana e Maria, conforme a ordem escolhida |
| `<<AUTORIA_APRESENTACAO>>` | a aluna Maria | as alunas Ana e Maria |
| `<<AUTORIA_ALUNOS>>` | aluna | alunas |
| `<<AUTORIA_MATRICULADOS>>` | matriculada | matriculadas |
| `<<AUTORIA_VERBO_CUMPRIR>>` | cumprir | cumprirmos |
| `<<AUTORIA_VERBO_AUTORIZAR>>` | autorizo | autorizamos |
| `<<DECLARANTES_VERBO_AUTORIZAR>>` | autorizamos | autorizamos |
| `<<AUTORIA_PRIMEIRO_NOME>>` | Maria | Ana |
| `<<AUTORIA_SEGUNDO_NOME>>` | vazio | Maria |

`AUTORIA_VERBO_AUTORIZAR` refere-se somente aos autores. O termo do Portal é
assinado por autores **e orientação**: para a oração conjunta deve-se usar
`DECLARANTES_VERBO_AUTORIZAR`, no plural mesmo com um único aluno. Exemplo:

> Eu, Maria, aluna do Curso [...], matriculada na disciplina [...], e a
> orientadora Professora Doutora Ana, autorizamos [...].

O texto antigo `Eu (nós)`, `aluno(s)`, `matriculado(s)`, `AUTORIZO(amos)` e
`Prof(ª). Dr(ª). orientador(a) NOME` é adequado durante a geração, incluindo
quando os títulos e o nome estão em trechos diferentes de formatação. As
assinaturas não recebem artigo antes do nome docente. Os marcadores individuais
`ALUNO_1_*` e `ALUNO_2_*` continuam representando as identidades originais. Os
marcadores `AUTORIA_*` representam a apresentação escolhida. Os antigos slots
`nome completo aluno (1)` e `(2)` seguem a ordem de apresentação na geração.

Rodada 63: `test:ci` aprovado com 685 testes unitários e 17 contratos; fluxo seguro
40/40, build e smoke HTTP aprovados. Navegador confirmou a pergunta e prévia no
cadastro, edição da ordem na ficha e persistência após recarregar. Integrações
externas não foram acionadas para enviar documentos, e a exportação real do PDF
pelo Google Drive continua exigindo conferência visual separada. Sem deploy.

## Consolidação das representações — rodada 64

A fonte de dados é única. A projeção `documentVariables` é compartilhada por
prévia textual, fluxo e geração dos quatro documentos. Para cada docente, o
cadastro captura nome, tratamento e titulação separadamente. O padrão documental
é por extenso. A prévia junto ao nome e a conferência final do cadastro usam esse
padrão; não é necessário cadastrar o mesmo nome outra vez em cada documento.

| Marcador de exemplo | Resultado |
| --- | --- |
| `<<ORIENTADOR_NOME_COMPLETO>>` | Professora Doutora Maria Silva |
| `<<ORIENTADOR_NOME_ABREVIADO>>` | Prof.ª Dr.ª Maria Silva |
| `<<ORIENTADOR_NOME_SIMPLES>>` | Maria Silva |
| `<<ORIENTADOR_FUNCAO>>` | orientadora |

As quatro formas existem também para `COORIENTADOR`, `EXAMINADOR_2` e
`EXAMINADOR_3`. Nos marcadores individuais dos alunos, as formas de nome mantêm o
nome civil cadastrado, sem títulos docentes. As variáveis `AUTORIA_*` continuam
responsáveis pela ordem e concordância, sem trocar as identidades individuais.
As abreviações explícitas permanecem abreviadas; a compatibilidade com fórmulas
antigas remove apenas os títulos genéricos e corrige a função junto ao docente
identificado. Na declaração, cada examinador recebe sua própria concordância.
Não se deduz titulação nem gênero de um nome antigo.

Variantes do trabalho e dos arquivos, derivadas dos dados já cadastrados:

- `TCC_CODIGO`, `TCC_TITULO`, `TCC_TITULO_ENTRE_ASPAS`, `TCC_TITULO_MAIUSCULO`.
- `TRABALHO_COMPLETO_NOME_ARQUIVO`, `TRABALHO_COMPLETO_VERSAO`.
- `RESUMO_EXPANDIDO_NOME_ARQUIVO`, `RESUMO_EXPANDIDO_VERSAO`.

Os nomes e versões dos arquivos vêm do envio registrado no repositório. Arquivo
não enviado produz valor vazio, sem inventar entrega ou versão. Esses marcadores
não expõem tokens, conteúdo binário ou URLs privadas de armazenamento. Valores
extras do fluxo não sobrescrevem as representações derivadas do processo.

Rodada 64: 688 testes unitários e 17 contratos aprovados, fluxo seguro 40/40,
TypeScript, build e smoke HTTP aprovados. Testes usam o exemplo da declaração em
quatro tipos documentais, as representações completa/abreviada/simples, variáveis
do trabalho/arquivos e proteção contra sobrescrita. Navegador local confirmou a
prévia por extenso e a conferência final com autoria, título e os três docentes.
Sem envio final do cadastro de teste, alteração dos originais do Drive ou deploy.
A exportação real no Google Drive continua sem conferência visual nesta rodada.

### Revisão de apresentação — rodada 71

A saída dos quatro documentos passa a abreviar tratamento e titulação (por
exemplo, `Prof.ª Dr.ª`, `Prof. Dr.` e `Prof.ª Ma.`), no corpo e nas assinaturas.
As variáveis de nome por extenso continuam representando o cadastro, mas a camada
de apresentação documental aplica a abreviação solicitada. A data final da ata
não inclui hora; o horário permanece somente na frase de encerramento.

### Escopo da autorização — rodada 73

`AUTORIZACAO_PUBLICACAO_ITENS` produz as duas linhas com marcas e decisão
expressa; `PUBLICACAO_TRABALHO_MARCA` e `PUBLICACAO_RESUMO_MARCA` permitem caixas
separadas em modelos novos. As três variáveis vêm das escolhas persistidas no
Repositório, independentemente da presença de arquivos. O termo mantém ambas as
opções visíveis e identifica também o que não foi autorizado.

### Nova decisão de papéis e nome escolhido — rodada 74

Orientador/Orientadora e Presidente passa a constar nos quatro documentos;
Examinador/Examinadora identifica os demais membros, sem números. Esta decisão
substitui a restrição da presidência da sessão apenas à ata.

O nome informado no cadastro é o nome de apresentação nos documentos, podendo
ser social. A grafia e a capitalização são preservadas; normalizam-se apenas
Unicode e espaços acidentais. Referência e titulação são escolhidas explicitamente.

### Frase guiada de autoria — rodada 75

O novo cadastro pede uma referência coletiva de autoria em `AUTORIA_REFERENCIA`:
`o aluno` / `a aluna` quando individual, `os alunos` / `as alunas` quando em dupla.
A frase mostra os nomes preenchidos, na ordem escolhida. O valor é projetado para
os metadados de apresentação usados pela gramática documental; não representa
uma inferência sobre identidade ou gênero a partir dos nomes. Os cadastros antigos
continuam legíveis. Novos envios v3 exigem escolha compatível com a quantidade.
