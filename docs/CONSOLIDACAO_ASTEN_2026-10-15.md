# Consolidação da assinatura Asten — 15/10/2026

Atualizado em 16/10/2026 após a conclusão real do piloto.

## Escopo e versão

A consolidação reúne as regras de signatários, o envio individual e em lote de declarações, a organização dos envelopes em pastas, o recebimento automático do PDF assinado e a atualização das telas que acompanham a assinatura.

O ambiente de teste separado é [Portal TCC — homologação](https://portal-tcc-homologacao.vercel.app). A publicação desta rodada é `dpl_DSexfXeeNRaVMUcM4hUTP76sviga`. A base do código é o commit `0e392dd4dee31d44ce2d6b12e2ddc21915450fdf`, com versão `1.0.79` em `package.json` e alterações locais ainda não commitadas. A versão mostrada no rodapé, sozinha, não identifica essas alterações nem prova equivalência entre localhost, GitHub e Vercel.

Após a publicação, `vercel inspect` confirmou que o endereço fixo da homologação aponta para esse deployment em estado `Ready`; a rota de saúde respondeu HTTP 200. O responsável concluiu o login no Portal e o perfil `MASTER_ADMIN` foi confirmado na sessão. Esse login não comprova que a sessão institucional no site da Asten foi resolvida.

Não houve commit, push ou publicação da instalação principal nesta rodada. Esta homologação usa banco, configurações e documentos fictícios próprios. Os quatro modelos fictícios que já estavam preenchidos nela foram preservados; esta consolidação não reformata Modelos e Variáveis.

## Regras compartilhadas

Os destinatários são derivados dos cadastros persistidos, sem aceitar substituição de e-mail pela requisição de envio:

| Documento | Signatários | Pasta escolhida no piloto |
| --- | --- | --- |
| Ata de defesa | Orientador do trabalho | `01 — Atas de defesa` |
| Termo de autorização de publicação | Aluno(s) e orientador, simultaneamente, na prioridade 1 | `02 — Termos de autorização de publicação` |
| Declaração de banca | Presidente da Comissão das configurações | `03 — Declarações de banca` |

A política compartilhada valida e-mails e rejeita destinatários ausentes, inválidos ou repetidos antes de gerar o documento. Permissão administrativa não dispensa os requisitos do fluxo. A ata exige avaliação concluída; o termo exige dados finais, pedido e confirmação de publicação; a declaração depende dos dados finais e da ata e do termo aplicável assinados e arquivados.

O perfil usado no piloto é `EMAIL_LINK`: convite por e-mail, envelope não confidencial, sem exigência de login Asten, SMS, celular ou formulário adicional de identificação. O signatário precisa abrir o documento e confirmar a assinatura na plataforma. O Portal não pode fabricar essa confirmação, e abrir apenas o convite não torna o documento assinado.

## Organização dos envelopes

O painel **Configurações → Integrações e Plataforma → Asten → Pastas dos documentos na Asten** permite ao Master selecionar e salvar três pastas diferentes do repositório conectado. O servidor verifica as pastas pela API, inclusive proprietário e repositório, e vincula a configuração cifrada à origem da instalação, à conta e ao repositório. A conta conectada, sem os três destinos válidos, não basta para liberar o fluxo.

O destino fica fixado no job antes da criação do envelope e participa de sua identificação de idempotência. O servidor verifica o repositório e a pasta retornados pela Asten antes de encaminhar convites. Uma divergência bloqueia o envio. Trocar os destinos nas configurações afeta os novos jobs; não move envelopes antigos nem altera a destinação de um job existente.

As três pastas do piloto foram consultadas e a configuração salva foi relida pela API em 15/10/2026. Essa confirmação verifica os destinos disponíveis e a seleção persistida; não representa uma nova assinatura real de cada tipo de documento.

Na conferência posterior pelo navegador, os três seletores exibiram os destinos corretos, o painel Asten indicou **Pronta** e o envio estava habilitado. A ação **Executar testes** retornou configuração validada com nove verificações de infraestrutura. A captura dessa conferência fica em `.portal-data/homologacao/painel-asten-consolidado.png`, como evidência privada e não versionada.

Os envelopes já assinados `92514` e `92517`, exclusivamente das duas atas fictícias do piloto, também foram organizados na pasta `01 — Atas de defesa` (ID `452`) do mesmo repositório `2528`. Essa foi uma operação técnica explícita sobre esses dois envelopes; salvar os destinos no painel continua sem mover o histórico automaticamente. A API confirmou os dois no destino, ainda com status de assinatura `3`, e os PDFs conservaram seus bytes e SHA-256 originais. O registro privado dessa verificação é `.portal-data/homologacao/atas-pastas-verificadas.json`.

Na preparação dessa movimentação, a API recusou com HTTP 400 a chamada que informava repositório e pasta juntos, com a mensagem `multiple assignments to same column "id_pasta"`. A rotina privada foi corrigida para informar apenas a pasta, dentro do mesmo repositório, e a leitura posterior confirmou o resultado. Nenhum novo envelope ou convite foi criado para essa organização.

## Retorno automático, arquivo e download

1. A Asten envia um aviso ao endpoint HTTPS autenticado do Portal.
2. O servidor grava o aviso na inbox privada do Supabase antes de responder sucesso ao provedor. A disponibilidade dessa tabela é verificada nas condições de envio.
3. O processamento em segundo plano consulta a Asten para confirmar o envelope e todos os signatários exigidos. O aviso recebido, isoladamente, não comprova a assinatura.
4. O servidor recebe o PDF original, valida sua estrutura sem regravar seus bytes, calcula o SHA-256 e confirma o armazenamento no Drive privado.
5. O job só chega a `ARCHIVED` depois da confirmação durável do arquivo. O download pelo Portal continua sujeito à autorização do usuário sobre o processo e o documento.

A inbox e os jobs preservam o estado para tentativas posteriores. O processamento respeita leases e recuo entre tentativas, sem reenviar envelopes cegamente em resultado incerto. O cron diário permanece como contingência de reconciliação. O retorno de um envelope já enviado e seu arquivamento usam a infraestrutura online, sem depender de a aba do usuário ou o Mac permanecerem ligados.

Enquanto houver jobs pendentes, as telas de processo e coordenação consultam o estado privado do Portal a cada 10 segundos quando estiverem ativas e sem edição em andamento. A consulta pausa em aba oculta, não sobrepõe requisições e para em conclusão ou perda de autorização. O intervalo de 10 segundos é uma frequência de atualização da tela; falhas externas podem aumentar o tempo até o PDF estar disponível.

O Portal não oferece preparação, upload ou conclusão manual de PDF assinado. A origem do arquivo arquivado é a API Asten.

## Envio individual e em lote

Os botões individual e em lote de declaração usam o mesmo caminho de envio e as mesmas regras de elegibilidade. O processamento elimina IDs repetidos, evita cliques concorrentes, reaproveita jobs existentes quando apropriado e mostra os resultados por documento. Uma falha parcial preserva na seleção os itens com erro e os ainda não tentados. Falhas de autenticação ou autorização interrompem os próximos envios.

O lote desta rodada é sequencial e conduzido pela aba. Ela precisa continuar aberta para iniciar as solicitações restantes; ainda não há uma fila durável de despacho em massa no servidor. Os envelopes já encaminhados continuam recebendo seus retornos no servidor, independentemente dessa aba.

## Evidências de validação

| Verificação executada | Resultado |
| --- | --- |
| `npm run test:ci` | 566 testes da suíte unitária e 17 contratos de provedores aprovados; TypeScript, busca de segredos, acessibilidade estática, verificações de finalização, build e smoke HTTP concluídos |
| `npm run test:secure-flow` | 40 verificações aprovadas, incluindo acesso exclusivo do Master às rotas de configuração das pastas e bloqueio de ações indevidas por alunos |
| `git diff --check` | Sem erros de whitespace |
| Destinos Asten da homologação | Três pastas consultadas, configuração salva e destinos resolvidos pela API real |
| Publicação e disponibilidade | Alias fixo confirmado por `vercel inspect` no deployment desta rodada, estado `Ready`, saúde HTTP 200 |
| Painel no navegador | Sessão Master confirmada; três destinos corretos, Asten pronta e envio habilitado; nove verificações de infraestrutura aprovadas |
| Organização das atas antigas do piloto | Envelopes `92514` e `92517` confirmados na pasta `452`, no mesmo repositório, com assinatura e bytes originais preservados |
| Preservação dos modelos | Quatro modelos fictícios da homologação comparados com o backup e preservados |

Os logs de execução ficam em `.portal-data/consolidacao-ci-final.log` e `.portal-data/consolidacao-secure-atual.log`, fora do material publicável. A pasta `.portal-data` não deve ser commitada. Os testes de fluxo seguro usam um servidor isolado e não substituem uma assinatura real.

Os dois pilotos de ata que já haviam sido concluídos pelo responsável demonstraram o retorno real:

| Piloto | Envelope Asten | Estado confirmado | Processamento automático do aviso `SIGNED` |
| --- | --- | --- | --- |
| `PILOTO-ASTEN-1` | `92514` | `ARCHIVED`; PDF original no Drive privado | Aproximadamente 6,9 segundos |
| `PILOTO-ASTEN-2` | `92517` | `ARCHIVED`; PDF original no Drive privado | Aproximadamente 8,4 segundos |

Não houve upload de PDF assinado nem pedido de reconciliação manual para concluir esses dois avisos. Em 15/10/2026, a verificação do primeiro piloto foi repetida: o PDF retornado pela Asten e o arquivo privado no Drive tinham os mesmos bytes e SHA-256. Os processos permaneceram em **Dados finais e repositório**, sem regressão visual para a inscrição. Os tempos observados nesses exemplos não são um acordo de prazo para novos envios.

## Fechamento real do piloto — 16/10/2026

O responsável concluiu pessoalmente as assinaturas. A verificação posterior confirmou:

| Documento | Envelope | Resultado | Retorno automático |
| --- | --- | --- | --- |
| Ata do piloto 1 | 92514 | Assinado e arquivado; bytes Asten/Drive idênticos | 6,9 segundos |
| Termo do piloto 1 | 92586 | Aluno e orientador assinados; pasta 453; PDF arquivado | 9,2 segundos |
| Declaração do piloto 1 | 92587 | Presidente assinado; pasta 454; PDF arquivado | 11,2 segundos |

O processo `pilot-asten-1` chegou a `CONCLUIDO` automaticamente, sem reconciliação manual nem upload de PDF assinado. A tela de Documentos exibiu os três como ASSINADO. Os downloads reais do termo e da declaração pelo Portal foram comparados por SHA-256 com os originais da Asten e do Drive: iguais. O arquivo fictício do trabalho, cuja publicação foi expressamente autorizada, respondeu HTTP 200 no endpoint público e conservou seus 66.573 bytes e SHA-256. Essa autorização não tornou públicos os PDFs de assinatura.

A carta-convite não foi gerada neste piloto: a preparação começou com defesa e avaliação já registradas. O fluxo de três tipos de assinatura foi exercitado; isso não representa validação de toda inscrição acadêmica desde o início.

A última alteração de interface trata a expiração de sessão, voltando à área pública em vez de deixar uma tela administrativa vazia. Após ela, passaram 15 contratos pertinentes, lint e build. A suíte completa anterior à alteração final aprovou 566 testes e 17 contratos de provedores; o fluxo seguro aprovou 40 verificações. O audit de dependências de produção não apontou vulnerabilidades conhecidas.

## Consumo, segurança e organização

O incidente do Supabase foi provocado pelo erro SQL `40001` em conflito de revisão da função de gravação. O PostgREST repetia internamente a transação. A migração `20261015205624_runtime_conflict_no_retry.sql` troca somente esse erro por `PT409`, mantendo a proteção de concorrência. Na homologação, dois processos presos foram encerrados após identificação precisa; o conflito passou a retornar HTTP 409 em 165 ms sem alterar o estado. O painel posteriormente mostrou CPU de 2%, sem o alerta. Os 13,7 GB observados eram ingestão histórica de logs, e não uma medida de CPU; corrigir a causa não zera o acumulado do ciclo.

A mesma migração foi aplicada ao banco principal. A leitura posterior confirmou PT409, ausência de 40001 e ausência de permissão de execução para anon/authenticated. Não foi encerrado backend do banco principal nem publicada uma nova aplicação principal.

Foram reforçados o vínculo entre desafio OTP e navegador, a autorização atual no retorno OAuth Google, os limites da fila de requisições e a verificação pública de PDF sem upload. Também foram preservados os registros operacionais na restauração de backup e vinculada a publicação ao conteúdo autorizado por hash. A revisão de segurança cobriu esses caminhos críticos; não foi uma auditoria exaustiva de cada arquivo nem um teste de invasão das plataformas externas.

O backup de negócio é cifrado, gravado no Drive e relido para conferir integridade e capacidade de decifrar. Um backup real passou por essa conferência. O cron diário online foi conectado à mesma rotina; a execução de seu próximo horário ainda não foi observada. Isso não substitui uma cópia física integral do Supabase nem comprova restauração completa em desastre.

O Drive ficou com duas pastas na raiz: Portal de TCC e Antigo. A homologação foi movida para Portal de TCC com a herança de acesso do editor existente expressamente autorizada. Sete pastas de legado foram arquivadas em Antigo. Os quatro modelos originais encontrados foram preservados, pois não havia prova de duplicidade. Nenhum arquivo foi excluído.

A interface recebeu o padrão de quatro níveis neutros, campos brancos e verde institucional, integrações em duas colunas, tabelas administrativas ocupando o espaço do modal, seletores dos estúdios e ajustes de cabeçalho e tutorial. Foram conferidos os layouts observados de 1.056 e 1.865 pixels; não foi comprovado um viewport móvel de 390 pixels.

## Limites de liberação

- As alterações da aplicação estão na homologação. O GitHub e a aplicação principal continuam na base anterior; não houve commit ou push desta consolidação.
- O banco de homologação continua necessário para isolar documentos fictícios, credenciais e testes do banco principal. Não deve ser excluído enquanto essa instalação o utiliza.
- O lote é sequencial e precisa da aba para iniciar os próximos envios. O retorno dos envelopes já enviados é online e independe do Mac. Não foi executado lote real com centenas de assinaturas nem teste de carga com centenas de usuários.
- A conta Google institucional conectada funciona para Drive, geração de documentos e e-mails. A verificação pública do aplicativo OAuth pelo Google continua pendente.
- O login do Portal, o token da API Asten e o login no site Asten UFES são conexões distintas. O token institucional funcionou nos três tipos de assinatura; a dificuldade de sessão no site UFES não foi declarada resolvida.
- O perfil de assinatura testado é EMAIL_LINK, sem login/SMS. Abrir o e-mail não conclui a assinatura: a pessoa abre o documento e confirma na Asten.
- O QR de autenticidade do Portal continua desabilitado nesta homologação; os testes de assinatura não devem ser apresentados como homologação desse recurso.
- A versão 1.0.79 no rodapé não identifica isoladamente o conjunto publicado. Conferir o deployment e a origem continua obrigatório.

Para configurar outra instalação, siga o [roteiro de configuração segura da Asten](./ASTEN_CONFIGURACAO_SEGURA_PASSO_A_PASSO.md).

A auditoria Codex Security foi finalizada e gerou relatório canônico com quatro achados do estado anterior às correções (um alto e três médios). As correções da aplicação estão publicadas na homologação e têm testes de regressão. A cobertura da auditoria é parcial; a ferramenta não disponibilizou a medição de tokens desta execução.
