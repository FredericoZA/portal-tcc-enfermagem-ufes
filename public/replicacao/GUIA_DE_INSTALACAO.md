# Tutorial de instalação e replicação do Portal TCC

Revisão documental: 09/11/2026.

Este guia prepara uma instalação independente. Ele não autoriza o acesso aos dados, arquivos ou credenciais da instalação de origem.

Código: https://github.com/FredericoZA/portal-tcc-enfermagem-ufes

Leia `README.md`, `CHECKLIST_IMPLANTACAO.md`, `IMPLANTACAO_PRODUCAO.md`, `COMECE_AQUI.md`, `CONTRIBUTING.md`, `SECURITY.md` e `docs/FLUXO_ATUAL_2026-10-26.md`. A versão está em `package.json`; confira também o commit. Arquivos locais, GitHub e Vercel podem estar em revisões diferentes. Relatórios RC anteriores são registros históricos, não certificados da instalação atual.

## Como o Portal funciona

O Portal TCC é um sistema administrativo para o ciclo completo do trabalho de conclusão de curso. A interface apresenta as etapas do processo; a API do servidor valida as permissões e aplica regras previamente definidas. Nenhum resultado acadêmico é decidido automaticamente.

**Caminho de um TCC:** cadastro dos autores e membros da banca → solicitação e confirmação de local e horário → convite → defesa e registro da deliberação pelo orientador → conferência e assinatura da ata → entrega do trabalho final → termo de autorização, quando houver publicação → declaração e encerramento.

**Documentos e parecer:** os modelos DOCX cadastrados pelo administrador são preenchidos com informações do processo e convertidos para PDF. O rascunho do parecer é montado por um dos três textos-base fixos — aprovado, aprovado com ressalva ou reprovado — com variações programadas de redação. O sistema não analisa o conteúdo acadêmico nem gera argumentos sobre mérito. O orientador deve preencher a fundamentação efetivamente deliberada pela banca, conferir a ata e confirmar o envio.

**Indicadores:** o servidor calcula contagens, percentuais, medianas e distribuições por fórmulas comuns. O acesso exige autenticação do Master ou da Presidência, validada no servidor. O relatório não inclui nomes, contatos nem campos livres e suprime grupos pequenos. As antigas rotas públicas foram encerradas. Essa estatística não utiliza modelos generativos, pontuação de estudantes nem inferência de resultados acadêmicos.

**Sugestões:** visitantes podem enviar voluntariamente melhorias pelo formulário público. O administrador lê e analisa as mensagens; elas não alimentam um mecanismo de recomendações ou de alteração automática do código.

**Acesso e segurança:** os participantes têm permissões associadas a seus papéis no processo. O banco Supabase guarda registros, permissões, auditoria e transporte privado temporário de arquivos; o arquivo definitivo de documentos, modelos e trabalhos é o Google Drive privado. A Asten, o Gov.br e o Gmail são utilizados somente conforme as etapas e autorizações configuradas.

**Legislação:** a Portaria Normativa GR/Ufes nº 310/2026 é referência para a revisão técnica desta instalação. Não existem chamadas a modelos de IA nos fluxos operacionais descritos. Isso não substitui as verificações de LGPD, segurança da informação, contratos, registros de tratamento e demais exigências institucionais aplicáveis.


## Arquitetura

| Serviço | Responsabilidade |
|---|---|
| React, TypeScript e Vite | Interface em `src/pages`, `src/components` e `src/styles`. |
| Express e TypeScript | API em `server.ts`, com autorização, sessões, regras do processo e auditoria. |
| Vercel | Frontend, funções HTTP, tarefas e reconciliação. O Portal deve funcionar com o computador do desenvolvedor desligado. |
| Supabase | Estado operacional, revisões, permissões, auditoria, idempotência e filas. O transporte temporário de arquivos usa armazenamento privado com prazo de limpeza. |
| Google Drive e Docs | Arquivo definitivo de trabalhos, documentos e modelos privados; mesclagem dos DOCX e exportação dos PDFs. |
| Gmail e Calendar | Código de acesso, comunicações do processo e divulgação das defesas. |
| Asten | Solicitação automática de assinatura nas etapas previstas, retorno autenticado e conferência do documento antes do arquivamento. |
| Gov.br | Assinatura externa do PDF e devolução ao Portal, seguida da conferência administrativa prevista no sistema. |

As integrações do produto usam suas próprias APIs e OAuth. Elas não dependem das ferramentas pessoais do desenvolvedor. Segredos ficam no backend, nunca no navegador, nas variáveis `VITE_`, no pacote ou no GitHub. Tabelas e arquivos internos permanecem privados.

## Escopo do sistema e cuidados institucionais

O Portal TCC é um sistema administrativo baseado em formulários, regras programadas, documentos e integrações de serviços. **Não é necessário contratar, conectar nem fornecer dados a um modelo de inteligência artificial para realizar a instalação ou operar os fluxos acadêmicos.** O cadastramento, as notificações, os relatórios e os textos-padrão usam programação convencional. As decisões acadêmicas permanecem sob responsabilidade dos agentes autorizados.

Para instituições públicas, a adoção do portal deve ser alinhada às regras internas de tecnologia, segurança, acessibilidade, proteção de dados e uso de serviços externos. Não copie documentos preenchidos, informações de estudantes nem credenciais da instalação original para testar a nova. Gere dados fictícios para os testes iniciais.

## Preparação da nova instalação

1. Confira origem, branch, commit e alterações locais. Preserve o trabalho existente e prepare recuperação antes de modificar uma instalação com dados.
2. Use contas e projetos próprios na Vercel, Supabase, Google Cloud e Asten. Crie uma raiz privada no Drive da nova instituição. Não reutilize a base, os usuários, as pastas ou os envelopes da Enfermagem UFES.
3. Confira Node e npm em `package.json`, instale com `npm ci` e use `.env.example` como referência. Antes de publicar, revise também o bloco `env` em `vercel.json`: a cópia do repositório contém o domínio, o projeto Supabase, as referências de pastas do Drive e a URL de retorno da ASTEN da instalação de Enfermagem. Substitua esses valores pelos da nova instalação e confira o Master inicial. Guarde os segredos nas variáveis protegidas do projeto Vercel. Mantenha o envio automático da ASTEN desligado até conferir a nova configuração.
4. Aplique as migrações necessárias na ordem. Confira runtime transacional, RLS, privilégios das funções, revisões, filas e armazenamento temporário privado.
5. Configure o Master inicial, a identidade do curso, a presidência da Comissão, os destinatários de reserva, os locais e as regras acadêmicas da nova instituição. A autorização de acesso deve refletir os e-mails efetivamente cadastrados e ativos.
6. Configure OAuth e callbacks do novo domínio. Autorize a conta Google institucional e conecte Gmail, Drive, Docs e Calendar. Configure o Asten e os destinos documentais na própria instalação.
7. Envie quatro DOCX próprios: convite, ata, termo e declaração. O ZIP de modelos desta página é uma referência de estrutura; adapte cópias e confira variáveis e dados institucionais. Se o download não estiver disponível, obtenha modelos com o responsável pela nova instituição. Não solicite credenciais da origem e não use documentos preenchidos de alunos como modelos.
8. Em Configurações, revise o conteúdo em E-mails, os campos em Formulários e os modelos em Documentos e Variáveis. Em Fluxos, selecione cada etapa e confira suas atividades, os papéis em Destinatários e os gatilhos. Em Integrações e Plataforma, confira o endereço de auditoria e o responsável pelo auditório e pela sala de reuniões. Publique a configuração após conferir o encadeamento.
9. Se a instalação oferecer a declaração de comparecimento, publique um PDF em branco pelo catálogo de documentos. A declaração de participação na banca é gerada no processo e segue para assinatura da Presidência.
10. Execute os testes automatizados e o piloto real descritos abaixo. Publique somente com autorização do responsável e registre a revisão implantada.

## Fluxo atual dos processos novos

### Cadastro e reserva

Um autor autenticado, cadastrado e autorizado usa **Meus TCCs → Cadastrar TCC**. O e-mail do primeiro autor corresponde à sessão. Protocolo e data de criação são gerados pelo sistema. Continuar salva a etapa; Salvar e sair preserva o rascunho.

Na última etapa, o autor escolhe um local e informa data e horário, com intervalo de 1h30. Auditório e sala de reuniões dependem do departamento; outro local informado pelo autor depende do orientador. Consultar mapa de salas, aulas, eventos, reservas e funcionamento do prédio evita retrabalho. Não se exige comparecimento prévio ao departamento.

O pedido já contém local, data e horário. O responsável apenas aceita ou recusa; não escolhe um local alternativo. Os botões de decisão são enviados somente ao responsável. Autores e orientador recebem comunicação informativa, sem esses botões. O resultado é enviado como resposta à conversa do responsável, com o comprovante em PDF. Responsável, autores e orientador são destinatários diretos; somente o endereço de auditoria configurado fica em cópia.

O bloqueio do local evita conflitos entre defesas do Portal; não verifica reservas externas. **Refazer reserva** e **Alterar reserva** permitem um novo pedido conforme a etapa, invalidando a confirmação anterior. Links de versões antigas não confirmam uma solicitação nova.

### Convite, conceito e ata

Com a reserva confirmada, o convite é enviado automaticamente em uma mensagem conjunta aos dois examinadores como destinatários, com cópia aos autores, orientador e coorientador, quando houver, além da auditoria configurada. Não gere um convite idêntico para cada examinador. A carta-convite fica em **Documentos administrativos** e não exige assinatura.

A partir do horário da defesa, com os requisitos anteriores concluídos, o orientador registra **Aprovado**, **Aprovado com ressalva** ou **Reprovado**, com parecer. O Portal TCC registra conceito e documentação. A avaliação acadêmica e o lançamento da nota são feitos em https://professor.ufes.br/ nesta instalação; outra instituição deve configurar sua referência própria.

O orientador visualiza e confere a ata e confirma o registro. O Portal abre **Documentos administrativos** e encaminha automaticamente o pedido pelo ASTEN. Assinam o orientador, os dois examinadores, os autores e o coorientador que participou da sessão, até seis pessoas. O ASTEN informa o estado do envio no cartão; cada signatário assina pelo link pessoal recebido por e-mail. Gov.br permanece como alternativa.

### Entrega e publicação

Após a ata assinada e arquivada, qualquer um dos autores preenche o resumo e as palavras-chave e anexa o PDF do trabalho completo em **Repositório acadêmico**. O trabalho completo é obrigatório; o PDF do resumo expandido é opcional.

Entrega e publicação são decisões distintas. Cada PDF tem sua própria autorização de publicação. O resumo textual do catálogo é apresentado como metadado do trabalho, sem usar a autorização do PDF para ocultá-lo.

**Confirmar entrega e ir para documentos** registra a entrega e abre **Documentos administrativos**. Sem publicação autorizada de nenhum arquivo, não há Termo. Havendo autorização, essa ação gera o termo e encaminha automaticamente o pedido ASTEN aos autores e ao orientador. Todos assinam o mesmo documento pelo link individual recebido por e-mail.

No Asten, todos assinam o Termo no mesmo nível. Pelo Gov.br, os autores e o orientador assinam o mesmo PDF; o orientador devolve o arquivo completo. O Master mantém a função administrativa prevista, sem dispensar assinaturas exigidas. O envio isolado não conclui a conferência.

### Declaração e encerramento

Após a entrega, a ata e o termo arquivados quando aplicável, a declaração é encaminhada automaticamente pelo ASTEN à presidência da Comissão. A pendência é acompanhada pela **Área do Presidente**, e a assinatura é feita pelo link pessoal recebido por e-mail ou pelo fluxo alternativo Gov.br. Essa presidência não se confunde com o orientador, que preside a sessão de defesa.

O processo só conclui após o arquivamento dos documentos exigidos. Criar envelope, enviar e-mail ou anexar PDF não comprova, por si só, uma assinatura concluída. Preserve idempotência, reconciliação e recuperação; não reenvie automaticamente um envelope de resultado incerto.

## Documentos e acervo legado

Processos novos usam cinco cartões em **Documentos administrativos**: comprovante de reserva, carta-convite, ata, termo e declaração. O Termo só se aplica quando houver publicação autorizada. Ver e Baixar PDF respeitam a disponibilidade e a permissão de cada documento.

Registros legados usam as mesmas telas do Portal, com código `NNN - Legado`, campos ausentes preservados e documentos originais. Neles há um sexto cartão para o instrumento histórico da banca, quando localizado. Esse instrumento não aparece em Conceito e Ata nem é criado para trabalhos novos.

Importar histórico não deve disparar novas assinaturas ou comunicações, inventar dados, recriar documentos assinados nem autorizar arquivos automaticamente. Preserve IDs, hashes e proveniência. Só publique os PDFs cuja autorização esteja comprovada.

## Acesso público e participantes

Clicar no código do TCC abre os detalhes públicos sem exigir login. Nomes, título, resumo, informações da defesa e arquivos liberados podem ser consultados. E-mails, matrículas, SIAPE, dados restritos e originais administrativos legados exigem autorização. A autorização é verificada no servidor, não apenas na interface.

Usuários vinculados entram com seu e-mail para praticar ações. Respeite os bloqueios de edição das etapas concluídas. Como usar mantém Aluno, Orientador e Visitante. A Área do Presidente e as Configurações são funções administrativas distintas.

## Verificação e entrega

- Execute `npm run test:ci` e `npm run test:secure-flow` em ambiente isolado. Confira segredos, autorização, acesso negado, concorrência de reservas, falhas e tempos de espera.
- Confira computador, celular, teclado e zoom. Imagens do manual devem retratar a versão conferida e usar dados fictícios.
- Faça um piloto real com destinatários controlados: login, aceite e recusa, convite conjunto, conceito, ata, entrega, publicação autorizada e recusada, termo e declaração. Verifique os bytes e destinos no Drive.
- Teste falhas e retomadas sem duplicar e-mails, envelopes ou arquivos. Nenhum erro pode liberar a próxima etapa.
- Confirme que código, migrações, configuração publicada e implantação são compatíveis. Teste o produto sem depender do Mac.
- Informe separadamente o que passou localmente, o que foi publicado e o que foi comprovado em Supabase, Google e Asten. Testes simulados não homologam integrações reais.

Não inclua `.env.local`, `.portal-data`, credenciais, PDFs de alunos, backups ou arquivos de execução no pacote. Alterar o modelo não reescreve documentos já expedidos ou assinados.
