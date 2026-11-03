# Portal TCC — Conectar Asten com segurança (roteiro da Secretaria)

**Situação em 15/10/2026:** duas atas fictícias foram assinadas na Asten real e arquivadas automaticamente no Drive privado da homologação separada. Os fluxos reais de termo e declaração ainda precisam de validação completa. Consulte [Consolidação Asten](./CONSOLIDACAO_ASTEN_2026-10-15.md) para as evidências e limitações. Essa publicação de teste não habilita a instalação principal; uma instalação sem liberação deve manter `ASTEN_INTEGRATION_ENABLED=false`. Não usar documento de aluno real no piloto.

## Conceitos simples
- **Token:** chave secreta que permite ao Portal consultar a conta Asten. Não enviar por conversa, e-mail, print, commit ou suporte público.
- **Repositório:** pasta lógica de envelopes na Asten; diferente da pasta do Google Drive.
- **Pasta Asten:** divisão dentro do repositório para organizar os envelopes de ata, termo e declaração. O envelope é a solicitação individual de assinatura, com documento e signatários; a pasta é o destino dessa solicitação.
- **Webhook/callback:** aviso automático enviado pela Asten ao Portal quando alguém assina. O Portal confirma o estado na própria API antes de concluir.
- **Homologação:** teste com documento fictício e signatários voluntários e autorizados, sem dados de alunos reais.

## 0 — Antes de qualquer clique (responsável técnico)
1. Confirmar CI/QA/CodeQL do PR e publicação da atualização de segurança com o **envio Asten desabilitado**.
2. Conferir credenciais no cofre do ambiente escolhido, sem as revelar: `ASTEN_WEBHOOK_SECRET` exclusivo (32+ caracteres), `PORTAL_SECRET_ENCRYPTION_KEY` com cofre Supabase durável, `PORTAL_PUBLIC_URL` correspondente ao ambiente e `ASTEN_CALLBACK_URL` com a mesma origem HTTPS e caminho `/api/integrations/asten/webhook`. Escolher o perfil de assinatura abaixo e configurar suas flags de forma coerente. O piloto separado usa `EMAIL_LINK`, sem exigir login nem celular. Manter os envios de produção desabilitados até autorização institucional e conclusão do piloto.
3. Verificar o plano Asten (API pode depender de contrato e saldo), acesso do Master, isolamento de dados, RLS da outbox v6 e Google Drive privado.
4. **Não ativar `ASTEN_INTEGRATION_ENABLED=true` antes de um teste controlado autorizado.** Produção exige ainda `ASTEN_PILOT_APPROVED=true` e `ASTEN_PRODUCTION_RELEASE_APPROVED=true`; este último deve permanecer **false/ausente durante a publicação para revisão estética**. Conectar e consultar a conta é permitido mesmo com os envios bloqueados.
5. Aplicar a migração `202610140001_asten_webhook_inbox.sql`. O callback grava o aviso na fila privada do Supabase antes de responder 200; a Vercel reconcilia em segundo plano com `waitUntil`. O cron diário `04:23 UTC` continua como contingência, sem depender do Mac. Uma falha externa pode adiar o arquivamento; o Portal só informa conclusão depois da confirmação do Drive.
6. Configurar as três pastas documentais com a conta Master. A prontidão de infraestrutura verifica a disponibilidade real da inbox e as pastas; uma chave conectada, isoladamente, não comprova que o envio ou o retorno estão prontos.

### Perfil de assinatura
- `CONFIDENTIAL_SMS` (padrão): envelope confidencial, autenticação 4, login e celular autorizado no cofre `asten_signer_contacts`.
- `EMAIL_LOGIN`: `ASTEN_SIGNING_PROFILE=EMAIL_LOGIN`, envelope não confidencial, `ASTEN_AUTHENTICATION_OPTION=0`, `ASTEN_REQUIRE_LOGIN=true` e `ASTEN_REQUIRE_CODE=false`; login Asten obrigatório, sem SMS.
- `EMAIL_LINK`: `ASTEN_SIGNING_PROFILE=EMAIL_LINK`, envelope não confidencial, `ASTEN_AUTHENTICATION_OPTION=0`, `ASTEN_REQUIRE_LOGIN=false` e `ASTEN_REQUIRE_CODE=false`. O destinatário abre o convite de e-mail e confirma a assinatura na Asten sem cadastro Asten, SMS ou formulário extra de identificação. O celular não é enviado ao provedor. Abrir o e-mail ou clicar no link inicial não conclui a assinatura.

O perfil fica registrado em cada job e faz parte da chave de idempotência. Cada nova versão documental tem um código de validação distinto; o código da primeira versão é preservado. A API real omite `opcaoAutenticacao` quando não há autenticação extra; login, identificação, código manual e delegação continuam sendo conferidos explicitamente. Antes de encaminhar, o Portal confere as flags e os destinatários realmente gravados pela Asten. Alterar o ambiente não modifica convites antigos. A substituição de um envelope de teste exige verificar ausência de assinaturas, cancelar no provedor e preservar o histórico local.

Em 14/10/2026, a API real da Asten confirmou que `confidencial=S` exige Código SMS. O piloto separado passou a usar `EMAIL_LINK` por escolha explícita do responsável. Essa escolha não ativa a instalação principal. A interface e a API bloqueiam o envio manual de PDF assinado. Para arquivar, o Portal consulta todos os signatários na Asten, valida a estrutura do PDF sem regravar seus bytes e confirma o armazenamento privado.

## 1 — Na Asten (você)
1. Entre na Asten com a conta institucional que efetivamente terá permissão sobre envelopes da UFES. Nesta implantação, a entrada institucional é [Asten UFES](https://plataforma.astenassinatura.com.br/login/UFES). A sessão dessa aba é independente do login do Portal e da conexão Google usada pelo Drive; um Gmail aberto no navegador não comprova acesso à conta institucional.
2. Acesse **Minha Conta → API**, como na captura enviada.
3. Confirme se o plano permite acesso à API e qual **repositório** é autorizado para testes.
4. Quando o responsável técnico confirmar o ambiente preparado: marque **Ativar API de Integração → Sim**, clique **Salvar** e localize o **Token** que a Asten gerar.
5. Não divulgue o token. Não cole o token em URL, arquivo, print, chat, e-mail ou campo de configuração pública.
6. **Deixe a “URL de Callback” global da Asten em branco inicialmente.** O Portal envia callback e cabeçalho de autenticação por envelope em `inserirEnvelope`; uma URL global preenchida sem o segredo personalizado será recusada (401). Não marque “Forçar JSON” automaticamente; a API já é acessada com cabeçalhos JSON por código.
7. Se houver mais de um repositório disponível, o responsável técnico escolherá o ID autorizado e o guardará no ambiente de execução como `ASTEN_REPOSITORY_ID`, sem adivinhar.

## 2 — No Portal TCC (você, conta Master)
1. Abra o site oficial e acesse **Configurações → Integrações e Plataforma → Asten**.
2. Cole o token **somente** no campo **Token da API Asten**.
3. Clique **Validar e conectar**. O Portal consulta a Asten, valida identidade e repositório e armazena o token criptografado no servidor. O campo limpa o token após sucesso.
4. Resultado esperado: conta validada; **envio: bloqueado** até fase piloto. Uma mensagem de pendência no status não significa que o token falhou: o despacho continua desligado de propósito.
5. Se retornar erro de repositório, não mexa nas permissões por tentativa e erro: comunique apenas o texto do erro **sem token**. O técnico escolherá a origem adequada.
6. Se retornar erro de conta/token, verificar se o botão Salvar foi confirmado na Asten e se a API está prevista no plano.

### Pastas dos documentos na Asten

Com a conta Master, no mesmo painel Asten, use **Pastas dos documentos na Asten**:

1. Atualize a lista de pastas do repositório conectado.
2. Selecione uma pasta diferente para **Ata de defesa**, **Termo de autorização de publicação** e **Declaração de banca**.
3. Clique em **Salvar pastas**. Se a sessão pedir nova autenticação, conclua o acesso por código no Portal e salve novamente.
4. Confirme a mensagem de destinos salvos. Os nomes usados no piloto são `01 — Atas de defesa`, `02 — Termos de autorização de publicação` e `03 — Declarações de banca`.

Somente o Master consulta e altera essa configuração no Portal. O servidor valida que cada pasta pertence ao proprietário e ao repositório conectados e guarda a seleção no cofre vinculada também à origem da instalação. Uma mudança de conta, repositório ou origem exige nova seleção.

O job conserva os IDs de repositório e pasta fixados na criação. Antes do encaminhamento, o Portal confere o destino retornado pela Asten; divergências bloqueiam o convite. Alterar a seleção não move envelopes antigos. Envelopes antigos ainda não enviados e sem destino validado podem exigir tratamento técnico explícito, preservando o histórico.

### Quem recebe e quem acompanha

| Documento | E-mail usado automaticamente |
| --- | --- |
| Ata de defesa | Orientador cadastrado no trabalho |
| Termo de autorização de publicação | Aluno(s) e orientador cadastrados, todos na prioridade 1 |
| Declaração de banca | Presidente da Comissão cadastrado nas configurações |

O envio não aceita trocar os destinatários na requisição. E-mails ausentes, inválidos ou repetidos entre os signatários bloqueiam a criação. O termo exige pedido e confirmação de publicação; a declaração aguarda a ata e o termo aplicável assinados e arquivados, além dos demais requisitos do fluxo.

Após a confirmação humana na Asten, o callback persiste o aviso e o servidor consulta o provedor, recebe o PDF original e o arquiva no Drive privado. O usuário baixa o documento pela rota autorizada do Portal; não precisa anexar uma cópia assinada. Enquanto há assinatura pendente, as telas de processo e coordenação consultam o estado do Portal a cada 10 segundos quando ativas. Esse intervalo de consulta não é um prazo garantido de entrega do provedor ou do Drive.

Ações individuais e em lote usam o mesmo fluxo de declaração. O lote envia uma solicitação por vez, preserva falhas e itens ainda não tentados e interrompe em falha de autenticação/autorização. É necessário manter a aba aberta para continuar a enviar os itens restantes; o retorno de envelopes já enviados é processado no servidor mesmo com a aba fechada.

## 3 — Piloto controlado (responsável técnico + Master)
- Criar uma **Ata fictícia**, com nomes e e-mails autorizados apenas para teste; escolher método de identificação aprovado pelo setor jurídico/LGPD. O método 2 solicita **documento com foto** e exige tratamento cuidadoso de dados pessoais.
- Ativar o interruptor de ENVIO Asten apenas em ambiente/escopo controlado, sem filas antigas pendentes; verificar outbox e jobs, confirmar ausência de envelopes incertos.
- Enviar **um** envelope fictício; verificar número, hash e ordem dos signatários, recebimento do e-mail e possibilidade real de concluir com a autenticação escolhida.
- Conferir webhook: segredo de cabeçalho, persistência durável, rejeição de eventos estranhos, duplicação e reconhecimento pelo reconciliador.
- Baixar o **PDF assinado** (`envelopeContent`, `incluirDocs=N`), comparar hash e signatários, arquivar no Drive privado, auditar registro e consultar status no Portal.
- Simular recusa, expiração, falha temporária da Asten, Drive indisponível e callback duplicado, sem emitir novo envelope acidentalmente.
- Confirmar que a ata não avança como concluída até que os signatários exigidos e a sincronização estejam confirmados.
- Desligar envios ao terminar o piloto; emitir relatório com evidências (sem segredos ou dados pessoais).

## 4 — Ativação real
**Somente após aceite formal do Master e responsável institucional**, e depois de aprovar explicitamente as três flags `ASTEN_INTEGRATION_ENABLED`, `ASTEN_PILOT_APPROVED` e `ASTEN_PRODUCTION_RELEASE_APPROVED` em escopo de produção. com metodologia de identificação, custos, plano, prazo máximo de sincronização, política de privacidade e contingência definidos. Realizar backup verificável, registrar mudança em GitHub, habilitar em janela controlada, monitorar logs e preparar rollback que **bloqueia novos envios**, sem apagar envelopes já existentes.

**Nunca:** colocar `ASTEN_WEBHOOK_SECRET`, API token, `CRON_SECRET` ou chave de criptografia em repositório, print ou conversa. Não ativar assinatura real só para verificar se o botão funciona.
