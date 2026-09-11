# Instrução de continuidade para a IA de implantação

Você recebeu o Portal Institucional de TCC **1.0.0-rc.10**. Sua tarefa é colocar esta versão em funcionamento no ambiente do proprietário, preservando o código existente, a identidade institucional e as regras abaixo. Trabalhe sobre o pacote recebido. Não substitua a aplicação por uma demonstração nova.

## Fonte de verdade e leitura

Leia primeiro `CHECKLIST_IMPLANTACAO.md`, `COMECE_AQUI.md`, `README.md`, `docs/FLUXO_OPERACIONAL_RC9.md`, `docs/RELATORIO_VALIDACAO_RC10.md` e `docs/HOMOLOGACAO_RC10.md`. Depois leia `IMPLANTACAO_PRODUCAO.md`, `.env.example`, `docs/PRIMEIRO_ACESSO.md`, `MODELOS_E_VARIAVEIS.md`, `INTEGRACAO_ASTEN_DRIVE.md` e `docs/ATUALIZACAO_E_ROLLBACK.md`.

A RC10 mantém o fluxo da RC9 e acrescenta as correções descritas no relatório RC10. Essas instruções prevalecem sobre RC5–RC8. Preserve as funcionalidades existentes. Trate os relatórios antigos como evidência histórica, sem atribuir seus testes à execução atual. Não afirme que uma integração funciona sem evidência real; registre **não confirmado** quando faltar essa evidência.

## Arquitetura existente

| Local | Responsabilidade |
|---|---|
| `src/pages`, `src/components` | Interface React e editor do Master |
| `src/components/AdvisorEvaluationPanel.tsx` | Conferência e formulário formal do orientador |
| `src/services/apiClient.ts` | Comunicação entre navegador e API |
| `server.ts`, `api/index.ts` | API Express, autorização, persistência e entrada Vercel |
| `server/workflow` | Eventos, bloqueios, avaliação, geração, prazos e recuperação |
| `server/integrations` | Google, Asten e Supabase |
| `src/utils/unifiedAppearance.ts` | Normalização das configurações visuais antigas |
| `src/utils/portalAppearanceLinks.ts` | Padrão compartilhado de aparência e pop-ups |
| `src/services/portalDialogs.ts`, `src/components/PortalDialogs.tsx` | Mensagens, confirmações e pedidos de texto |
| `supabase/migrations` | Migrações necessárias, aplicadas na ordem dos nomes |
| `scripts` | Compilação, verificação e geração do ZIP |

O projeto usa React, Vite e Express. Preserve `package-lock.json` e os scripts atuais. A produção está preparada para Vercel com Node.js 22, estado no Supabase e documentos no Google Drive. Esta rodada não acrescentou migração SQL; os campos de conferência e aparência estão no estado JSON existente. A RC10 foi validada em Node.js 22.23.2. Repita os testes após configurar o ambiente de implantação.

## Regras obrigatórias

- Master e Presidente administram. O aluno precisa de autorização prévia e pode ser autor de somente um TCC de graduação.
- O pedido de reserva vai para o endereço canônico do departamento. O aluno declara que recebeu a confirmação e o processo aguarda essa declaração antes do convite.
- O orientador confere os dados e informa nota de 0 a 10, com até duas casas decimais. Revisões desatualizadas do processo ou do formulário são recusadas. O resultado vem das opções publicadas, e o texto fixo da ata vem do DOCX do Master.
- Convite não é assinado. Ata: orientador. Termo, quando houver publicação: todos os alunos autores e o orientador, em paralelo. Declaração: Presidente da Comissão.
- Asten executar envio ou criar envelope não significa assinatura concluída. Exija o retorno compatível com os signatários previstos e o arquivamento do PDF assinado.
- Falhas não liberam a próxima etapa. Preserve a recuperação existente e não repita automaticamente envelopes de resultado incerto.
- Modelos são DOCX externos com marcadores `<<VARIAVEL>>`, versionados no Drive e vinculados por hash. O Master define campos, variáveis, modelos, e-mails e fluxo publicado.
- Preserve a entrega final, os arquivos privados e a publicação condicional do termo. Não elimine essas etapas para encurtar a implantação.
- Publique uma aparência comum. Não reintroduza desvinculação visual por tabela ou pop-up. Cada tabela pode manter suas colunas e filtros.
- Nunca coloque credenciais no código, no ZIP, no repositório ou em variáveis `VITE_`.

## Correções RC10 que devem ser preservadas

- `server/httpApp.ts` encaminha erros assíncronos ao tratamento HTTP. API inexistente devolve JSON 404. Não permita que a aplicação React responda como se fosse uma API válida.
- `src/utils/studioFormAnswers.ts` valida campos e impede que os quatro formulários nativos apareçam como formulários adicionais. Cada etapa nativa usa seu endpoint próprio.
- Envie `expectedFormRevision` nos formulários adicionais. O servidor registra o autor no identificador de envio e guarda `formSnapshot` antes de chamar o Drive. A retomada usa as perguntas originais.
- A confirmação repetida do mesmo local conserva o autor, horário e revisão anteriores. Alteração de local já confirmado exige correção formal.
- Respostas com `workflowPending` significam dados salvos com continuidade pendente. Não exiba convite enviado ou publicação pública antes de concluir as etapas necessárias.
- A fonte e as cores compartilhadas são normalizadas em `unifiedAppearance.ts` e `portalFonts.ts`. Não restaure exceções visuais antigas.
- `PortalErrorBoundary` permite recarregar uma página que falhou. O formulário do orientador oferece nova tentativa quando não consegue carregar a configuração.
- O desenvolvimento Vite usa nonce para autorizar o preâmbulo React; o cliente compilado mantém `script-src 'self'`. Não abra a política de scripts da produção para corrigir o desenvolvimento.
- O ZIP não segue links simbólicos nem inclui `.vercel`, `.portal-data`, `.env` real, dependências ou arquivos de execução.

## Sequência de execução

1. Identifique se já existe repositório e implantação da mesma instalação. Faça backup antes de modificar um ambiente com dados. Evite criar projetos duplicados.
2. Instale as dependências com `npm ci`. Execute `npm run test:ci` e `npm run test:secure-flow`. Corrija falhas concretas antes de avançar. Registre versão do Node, comandos e resultados.
3. Conecte Supabase e aplique as migrações pendentes. Confirme runtime v6, RLS, privilégios das funções, bucket privado, revisão otimista e outbox Asten. Preserve o arquivo documental definitivo no Drive.
4. Configure a Vercel e as variáveis documentadas em `.env.example`, com segredos próprios do ambiente. Não use o arquivo de demonstração em produção.
5. Conecte Drive, Docs, Gmail e Calendar pelo OAuth do proprietário. Complete o bootstrap do Master conforme o guia. Configure o token Asten e o callback autenticado pelo portal.
6. Cadastre os quatro DOCX oficiais e os endereços institucionais, incluindo o departamento e o Presidente. Se esses materiais não estiverem disponíveis, informe exatamente qual item falta; não crie um modelo oficial fictício.
7. No Estúdio, revise o formulário do aluno e o formulário `form-parecer-banca`. O servidor injeta os campos essenciais de avaliação mesmo em configuração antiga. Confira também a ordem das ações, os marcadores, o destino de cada e-mail e a aparência. Publique a configuração coerente.
8. Execute o piloto de `docs/HOMOLOGACAO_RC10.md` com destinatários controlados e documentos de teste. Confirme o processo individual e em dupla, com e sem publicação.
9. Teste a interface no navegador, em computador e celular, incluindo teclado e zoom. Confira o retorno do foco após os diálogos. Gere e revise as capturas usando o procedimento de homologação do pacote.
10. Entregue URL, identificação da versão, migrações aplicadas, resultados do piloto, pendências e instruções objetivas de uso. Respeite a autorização de publicação dada pelo proprietário e não altere acessos além do necessário para a instalação.

## Evidência de encerramento

Relate separadamente: execução local, implantação, persistência real, e-mails reais, PDFs gerados dos DOCX, assinaturas Asten, arquivamento no Drive e inspeção visual. Para cada um, use “aprovado”, “reprovado” ou “não confirmado”, com evidência e próxima ação. Não declare o portal pronto para processos reais apenas porque compilou.
