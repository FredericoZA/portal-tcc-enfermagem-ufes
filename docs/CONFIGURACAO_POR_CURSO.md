# Configuração desta instalação

Este portal atende somente o Curso de Enfermagem. Caso outra secretaria reutilize o código aberto, ela deverá criar outra implantação, outro banco, outra pasta raiz e outras credenciais. Não compartilhe a mesma base entre cursos.

## Identidade

Em **Configurações → Governança**, defina o nome público, instituição, siglas, curso, unidade, campus, cidade, domínios de e-mail, prefixo dos protocolos, instituição interna padrão, local padrão e pasta raiz do Drive. Esses dados alimentam cabeçalho, navegação, calendário, PDFs auxiliares e nomenclaturas.

## Aparência

O Master escolhe uma paleta acessível e publica o padrão global de barras, tabelas e pop-ups. Tabelas novas partem de 14 px e herdam cores, tipografia, densidade, bordas e cabeçalhos do padrão global. Colunas, ordem e quantidade de linhas permanecem individuais. Um componente só deixa de herdar quando o Master ativa explicitamente a personalização individual; remover a sobrescrita restaura a herança.

Use contraste mínimo WCAG AA, fonte legível, foco visível por teclado e não dependa apenas de cor para comunicar estado.

## Fluxo executável

As etapas respondem a eventos exatos do sistema. Cada ação referencia um documento, e-mail ou formulário com executor conhecido. A publicação é bloqueada se houver referência quebrada ou ação interna genérica. Salvar cria rascunho; **Publicar** cria a versão utilizada por todos.

### Configuração operacional

A configuração publicada é uma unidade versionada e contém:

- identidade visual, idioma, fuso, acessibilidade e políticas operacionais;
- vínculos com modelos DOCX externos do Google Drive — nunca o conteúdo embutido no programa;
- formulários, perguntas, validações e regras condicionais por papel;
- e-mails em texto/HTML, destinatários canônicos do processo e anexos provenientes do fluxo;
- matriz única de variáveis e seus aliases;
- etapas e ações condicionais do fluxo.

Antes da publicação, o painel mostra uma pontuação de prontidão e erros por área. A publicação é recusada enquanto houver erro. Cada publicação cria checksum, autor, data e revisão restaurável.

Os modelos externos também recebem revisão e SHA-256 no momento da publicação. Uma alteração direta no Drive bloqueia a geração até nova publicação consciente. Nos e-mails, respostas de formulário não podem definir destinatários, e todo conteúdo dinâmico é escapado antes de entrar no HTML publicado pelo Master.

### Formulários personalizados

O Master define o público de cada formulário: Aluno, Orientador, Banca ou Presidente. O servidor repete essa autorização tanto na leitura quanto no envio. Campos podem depender de respostas anteriores e ter tamanho, faixa numérica, expressão de validação e mensagem própria. Um envio válido:

1. registra a revisão exata do formulário e um checksum idempotente;
2. cria uma cópia PDF na pasta privada do TCC;
3. grava a auditoria;
4. dispara o evento `FORM_<ID_DO_FORMULARIO>_SUBMITTED`.

Campos de arquivo personalizados recebem link seguro do Google Drive. O trabalho completo e o resumo expandido continuam usando o carregamento PDF especializado do processo, com validação de tamanho e hash.

### Aparência coerente

Paleta, tipografia, densidade, raio, bordas, foco e tamanho mínimo de interação compõem o padrão global. Tabelas e pop-ups herdam esses tokens; apenas estrutura específica — colunas, ordem, paginação e campos — começa individual. Uma sobrescrita visual só existe após desvinculação explícita.

## Papéis

- **Master e Presidente:** administração global, auditoria, alunos, aparência, fluxo e processos.
- **Aluno autor:** um único TCC de graduação, sem impedir outros vínculos futuros.
- **Orientador/coorientador/banca:** somente processos em que o e-mail foi vinculado.
- **Visitante:** calendário, tutorial, autenticidade e itens expressamente públicos.

A autorização automática de participantes ocorre no servidor depois do primeiro formulário. O navegador não escolhe papéis nem concede acesso.
