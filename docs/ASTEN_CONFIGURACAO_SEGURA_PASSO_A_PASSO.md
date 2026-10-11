# Portal TCC — Conectar Asten com segurança (roteiro da Secretaria)

**Situação:** integração preparada em código; **não homologada com a conta Asten real**. A preparação não autoriza assinaturas, produção mantém `ASTEN_INTEGRATION_ENABLED=false`. Não usar documento de aluno na homologação.

## Conceitos simples
- **Token:** chave secreta que permite ao Portal consultar a conta Asten. Não enviar por conversa, e-mail, print, commit ou suporte público.
- **Repositório:** pasta lógica de envelopes na Asten; diferente da pasta do Google Drive.
- **Webhook/callback:** aviso automático enviado pela Asten ao Portal quando alguém assina. O Portal confirma o estado na própria API antes de concluir.
- **Homologação:** teste com documento fictício e signatários voluntários e autorizados, sem dados de alunos reais.

## 0 — Antes de qualquer clique (responsável técnico)
1. Confirmar CI/QA/CodeQL do PR e publicação da atualização de segurança com o **envio Asten desabilitado**.
2. Conferir credenciais no cofre de produção, sem as revelar: `ASTEN_WEBHOOK_SECRET` exclusivo (32+ caracteres), `PORTAL_SECRET_ENCRYPTION_KEY` com cofre Supabase durável, `ASTEN_CALLBACK_URL` apontando para `https://portal-tcc-enfermagem-ufes.vercel.app/api/integrations/asten/webhook`, `PORTAL_PUBLIC_URL` oficial, `ASTEN_REQUIRE_LOGIN=true`, `ASTEN_REQUIRE_CODE=false`, `ASTEN_AUTHENTICATION_OPTION=2` até decisão institucional formal.
3. Verificar o plano Asten (API pode depender de contrato e saldo), acesso do Master, isolamento de dados, RLS da outbox v6 e Google Drive privado.
4. **Não ativar `ASTEN_INTEGRATION_ENABLED=true` antes de um teste controlado autorizado.** Produção exige ainda `ASTEN_PILOT_APPROVED=true` e `ASTEN_PRODUCTION_RELEASE_APPROVED=true`; este último deve permanecer **false/ausente durante a publicação para revisão estética**. Conectar e consultar a conta é permitido mesmo com os envios bloqueados.
5. Vercel no plano Hobby tem cron **somente diário**. O serviço de reconciliação automática está programado para `04:23 UTC`, podendo variar até uma hora. Não prometer atualização de assinatura instantânea. O Master pode reconciliar um envelope específico usando o fluxo já autenticado/limitado do Portal. Frequência maior exige desenho de agendamento alternativo ou aprovação de plano superior.

## 1 — Na Asten (você)
1. Entre na Asten com a conta institucional que efetivamente terá permissão sobre envelopes da UFES.
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
