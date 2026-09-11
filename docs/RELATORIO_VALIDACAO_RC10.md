# Validação da revisão final RC10

Versão: **1.0.0-rc.10**. Data: **10 de setembro de 2026**. Base: RC9. Escopo: correções de funcionamento, padronização e pacote completo para implantação. Nenhuma alteração foi aplicada a dados de produção, e nenhum e-mail real foi enviado nesta revisão.

## Correções verificáveis no código

| Problema identificado | Correção |
|---|---|
| Promessa rejeitada podia escapar do tratamento do Express | Encaminhamento central para erro HTTP em JSON, com identificador de ocorrência |
| API inexistente podia receber HTML do portal | Resposta JSON 404 antes do fallback da aplicação |
| Vite injeta preâmbulo React inline, incompatível com a política anterior | Nonce no HTML e na política do desenvolvimento; cliente compilado mantém scripts da própria origem |
| Etapas nativas apareciam como formulários adicionais | Cadastro, reserva, avaliação e entrega final ficam em seus endpoints próprios |
| Formulários adicionais aceitavam escolhas, tipos e confirmações inadequadas | Validação compartilhada; opções publicadas, booleanos, números, datas, limites e revisão |
| Arquivamento posterior podia usar perguntas modificadas pelo Master | Perguntas originais registradas antes da chamada ao Drive e preservadas na retomada |
| Identificadores de respostas iguais podiam coincidir entre autores | Autor incluído no identificador; repetição do mesmo envio conserva o registro |
| Repetição de reserva criava nova revisão | Confirmação repetida do mesmo local retorna o estado salvo sem alterar a declaração |
| Sucesso no salvamento era confundido com conclusão do fluxo | Mensagens de pendência em cadastro, convite, avaliação e entrega final |
| Fonte da tabela podia divergir da fonte do pop-up | Fonte e cores compartilhadas normalizadas no servidor e no editor |
| Falha de carregamento podia deixar tela sem saída | Recarregamento da tela e nova tentativa no formulário do orientador |
| Empacotador seguia links simbólicos | Links ignorados; dados de execução, segredos locais e metadados de hospedagem excluídos |

## Evidências locais

As verificações usam dados fictícios e não comprovam comportamento dos provedores reais.

| Verificação | Resultado |
|---|---|
| Runtime | Node.js **22.23.2**, npm **11.9.0** |
| TypeScript | Aprovado, sem erros |
| Suíte automatizada | **95 testes aprovados, 0 falhas** |
| Contratos de provedores | Aprovados; também integram a suíte acima |
| Fluxo seguro | **38 verificações aprovadas, 0 falhas**, incluindo verificações estáticas e HTTP |
| Acessibilidade estática | Aprovada em **123 arquivos**; não equivale a auditoria visual, de teclado ou leitor de tela |
| Compilação | Vite e servidor esbuild aprovados |
| Servidor compilado | Saúde, SPA, cabeçalhos, política de scripts e separação cliente/servidor aprovados |
| Auditoria npm | **0 vulnerabilidades conhecidas** no resultado da consulta desta revisão, incluindo dependências de desenvolvimento |
| ZIP | Estrutura e integridade verificadas no empacotamento; versão e seis migrações incluídas |

A prova HTTP inclui: aluno impedido de lançar nota e de preencher formulário de orientador; revisão antiga recusada; opções inválidas recusadas; envio repetido sem duplicar registro; preservação das perguntas; confirmação de local sem incrementar revisão; conferência/nota persistidas; aparência publicada; JSON de erro sem o segredo usado no teste; servidor continua respondendo depois de erro.

## O que permanece não confirmado

| Item | Situação e ação necessária |
|---|---|
| Inspeção visual no navegador | **Não confirmado.** Chromium não estava disponível. A instalação via Playwright expirou; a alternativa via npm foi recusada pelo registro. Execute o piloto visual no ambiente de implantação. |
| Supabase e Vercel desta instalação | **Não confirmado.** Consultas de identificação não localizaram vínculo inequívoco com este pacote. Não houve implantação nem alteração remota. |
| E-mails recebidos e reserva real | **Não confirmado.** Exige Google configurado e destinatários de teste autorizados. |
| Fidelidade dos quatro DOCX | **Não confirmado.** Os modelos oficiais devem ser cadastrados pelo Master e comparados com os PDFs gerados. |
| Assinaturas e callback Asten | **Não confirmado.** Exige token, callback e envelopes de teste na conta responsável. |
| Concorrência, reinício e limites da hospedagem | **Não confirmado** no ambiente remoto. Verificar no piloto, incluindo arquivos grandes e outbox. |

O código pode ser entregue à IA de implantação. A liberação institucional depende das evidências do piloto; os testes locais não substituem essa etapa. Use `CHECKLIST_IMPLANTACAO.md` e `docs/HOMOLOGACAO_RC10.md`.

Referências técnicas consultadas durante a correção: documentação oficial de tratamento de erros do Express (`https://expressjs.com/en/guide/error-handling/`), limites de erro do React (`https://react.dev/reference/react/Component`) e integração/CSP do Vite (`https://vite.dev/guide/backend-integration`, `https://vite.dev/guide/features#content-security-policy-csp`). As versões executadas são as fixadas no `package-lock.json`.
