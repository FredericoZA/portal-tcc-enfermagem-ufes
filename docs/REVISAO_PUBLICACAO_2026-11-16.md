# Revisão local da publicação — 16/11/2026

A interface usa apenas o botão vermelho **Alterar publicação dos arquivos**, no canto superior direito do Repositório acadêmico. A caixa adicional foi removida. A edição reutiliza o formulário anterior, liberando as escolhas independentes de publicação e a substituição dos PDFs. Resumo e palavras-chave permanecem bloqueados nessa operação. Cancelar sem substituir arquivo ou salvar não altera o cadastro.

Nos processos novos concluídos, podem operar o Master e os autores com acesso ativo. Nos registros legados, somente o Master. A política é validada no servidor, inclusive na preparação dos uploads; papel de orientador ou coincidência de nome não concedem essa ação.

A substituição de um PDF bloqueia a consulta pública e invalida a autorização anterior antes de permitir a nova versão. A ata e a declaração arquivadas são preservadas. Após confirmar a alteração, os PDFs do termo anterior são excluídos do Drive; os metadados da solicitação permanecem para auditoria e bloqueio de retornos antigos. Se a exclusão falhar, a alteração fica pendente e não libera publicação. Uma nova liberação exige novo termo assinado pelos autores e pelo orientador, com sincronização no Drive. Uma restrição não gera termo vazio. Uma assinatura atrasada de versão superada não reativa a publicação.

O legado conserva sua identidade e documentação, sem ser inserido como processo acadêmico novo. A renovação do consentimento fica em sua proveniência privada. Se faltarem contatos históricos confirmados, a publicação fica pendente e restrita. A importação documental continua limitada ao espelhamento conferido do site da Enfermagem; um consentimento histórico positivo não reabre um trabalho retirado.

Nos legados, os seis cartões seguem esta ordem: comprovante de reserva, carta-convite da banca, instrumento de avaliação, ata, termo de autorização e declaração. O instrumento de avaliação continua restrito.

## Validação executada

- 85 testes direcionados aprovados em `output/publication-choice/targeted-final.log`, incluindo consentimento, permissões, retornos de assinatura, restauração, persistência e leitura SQL do repositório.
- Os seis testes das rotas foram repetidos após o ajuste de retomada pelo Master e passaram: `routes-final.log`.
- TypeScript, compilação cliente/servidor, inicialização serverless, smoke HTTP e acessibilidade estática passaram.
- Navegador: login normal por código de uso único, com conta fictícia Master; abertura e cancelamento da edição no formulário dos processos novo e legado. Antes da correção visual, a retirada pelo autor também foi exercitada no ambiente isolado; a integração ausente foi apresentada como pendente, sem falsa confirmação de retirada no Drive.
- A suíte geral não foi aprovada: vários ambientes HTTP excederam o prazo de inicialização. A execução foi interrompida e os testes direcionados foram executados separadamente.

## Limites e publicação

Esta rodada está local e usa `.portal-data/publication-choice-review`. Não enviou assinaturas reais, não alterou ACLs reais do Drive e não executou push, deploy ou migração remota. A função de leitura do repositório precisa levar `publicationOverride` antes da publicação desta versão; seu SQL foi verificado em PGlite e permanece restrito a `service_role`. A referência de segurança foi conferida na documentação oficial: [documentação oficial de funções do banco](https://supabase.com/docs/guides/database/functions).

O binário Supabase instalado pelo Homebrew terminou com SIGKILL, inclusive em `--version`. A instalação temporária do mesmo pacote oficial também terminou com SIGKILL; o resultado está em `output/publication-choice/migration-cli.log`. O SQL permanece como proposta em `docs/sql/repository-publication-override.sql`, fora da fila de migrações; a geração e aplicação remota ficam para a publicação desta versão. Não foram alteradas proteções do Mac ou configurações globais do Codex.

Telas: `output/publication-choice/botao-vermelho.jpg`, `formulario-edicao.jpg`, `legado-edicao-master.jpg` e `ordem-documentos-legados.jpg`. Os arquivos `solicitacao-aluno.jpg` e `restricao-pendente.jpg` registram a proposta visual anterior, rejeitada pelo usuário; não representam a interface final.
