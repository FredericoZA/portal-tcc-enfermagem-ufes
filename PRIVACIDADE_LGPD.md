# Privacidade, LGPD e continuidade operacional

## Escopo e princípios

O portal centraliza processos de TCC, mas separa responsabilidades:

- **Supabase:** estado transacional, identidade, autorização, auditoria, filas e metadados.
- **Google Drive privado do Master:** documentos, formulários exportados em PDF, trabalhos e comprovantes.
- **Asten:** envelopes e evidências de assinatura.
- **Gmail:** transporte dos e-mails; o portal registra o aceite pelo provedor, não presume entrega final.

O Supabase fornece persistência ao sistema. Ele não deve ser descrito nem configurado como mecanismo de “aprendizado contínuo” sobre pessoas. Nenhum dado pessoal ou documento pode ser usado para treinamento de modelos sem uma finalidade, base legal, transparência e governança próprias.

Os únicos papéis administrativos globais são `MASTER_ADMIN` e `COMMISSION_PRESIDENT`. A chave `service_role` fica exclusivamente no backend. Navegadores não recebem acesso direto às tabelas normalizadas nem ao Drive.

## Finalidades e bases legais

Antes da produção, o controlador deve registrar com o encarregado de dados da UFES:

1. a finalidade de cada dado coletado;
2. a base legal aplicável a cada tratamento acadêmico e administrativo;
3. os operadores envolvidos (Supabase, Google, Asten, Vercel e provedores auxiliares);
4. os prazos da tabela de temporalidade institucional;
5. o canal para exercício dos direitos do titular;
6. o procedimento de incidente e comunicação.

A publicação do trabalho e do resumo expandido é uma decisão separada do tratamento acadêmico obrigatório. Quando nenhuma publicação for solicitada, o Termo de Autorização para Publicação não deve ser criado. Quando houver publicação, o portal deve guardar a decisão, a versão do arquivo, o hash e o Termo assinado antes de disponibilizar o conteúdo.

## Minimização e classificação

| Classe | Exemplos | Regra mínima |
|---|---|---|
| Identificação | nome, e-mail, matrícula | Apenas pessoas e processos autorizados |
| Acadêmico | formulários, avaliação, ata, trabalho | Drive privado; acesso via portal com autorização por processo |
| Publicável | trabalho ou resumo expressamente autorizado | Somente após assinatura e conclusão do processo |
| Segurança | IP/e-mail em hash, tentativas OTP, logs | Nunca registrar código OTP, token, chave ou documento integral |
| Segredo | service role, token Asten, refresh token Google | Cofre/variável cifrada no servidor; jamais no banco em texto ou no navegador |

Campos livres de auditoria (`details`) devem conter identificadores técnicos e mudanças objetivas. Não devem duplicar resumos, pareceres, documentos, tokens, códigos de acesso ou dados pessoais que já existam na entidade de origem.

## Retenção proposta

Os prazos abaixo são parâmetros técnicos iniciais, não uma decisão jurídica. O Master só deve ativá-los depois da validação pela UFES e da tabela de temporalidade aplicável.

| Informação | Retenção técnica sugerida | Encerramento |
|---|---:|---|
| OTP consumido ou expirado | até 24 horas | exclusão irreversível |
| Sessão do portal | até expirar/revogar | exclusão e invalidação imediata |
| Falha de e-mail sem conteúdo | 180 dias | agregação estatística e exclusão |
| Auditoria operacional | 2 anos | anonimização dos identificadores e expurgo do detalhe |
| Processo acadêmico e documentos | conforme tabela institucional | arquivamento ou eliminação aprovada |
| Arquivo publicado | enquanto houver autorização e finalidade | retirada pública imediata após decisão válida |
| Segredos de integração | até revogação/rotação | revogação no provedor e remoção da cópia cifrada |
| Backups | conforme plano Supabase/Google contratado | expiração automática e restauração restrita |

A retirada pública não apaga automaticamente o registro acadêmico privado. O portal deve alterar a visibilidade no mesmo ato, invalidar URLs temporárias e registrar a retirada. A eliminação do arquivo-fonte é uma decisão separada, sujeita à obrigação de guarda.

## Direitos do titular e exportação

1. O titular autentica o e-mail por código e solicita acesso/correção pelo portal.
2. Master ou Presidente valida identidade, escopo e fundamento da solicitação.
3. O backend monta um pacote com os dados do solicitante e processos dos quais ele participa.
4. Dados de terceiros são omitidos ou minimizados quando não forem indispensáveis.
5. O pacote recebe hash SHA-256, prazo curto de download e registro de auditoria.
6. O download exige nova sessão válida; links públicos ou permanentes são proibidos.

Formato recomendado: índice JSON legível por máquina, relatório PDF legível por pessoa e cópias dos documentos que possam ser legitimamente entregues ao solicitante.

## Correção, revogação e anonimização

- Revogar a entrada de acesso deve bloquear novos logins e invalidar as sessões ativas imediatamente.
- Revogação da lista não remove autoria, assinatura ou registro acadêmico.
- Correções preservam a versão anterior na auditoria sem copiar conteúdo sensível para o log.
- Anonimização substitui nome, e-mail e matrícula por identificador aleatório não reversível, remove vínculos dispensáveis e apaga cópias desnecessárias.
- Assinaturas, atas e documentos sujeitos a guarda não são anonimizados automaticamente; precisam de análise da obrigação legal/institucional.
- Logs expirados devem perder `actor_user_id`, hashes correlacionáveis e detalhes pessoais antes do expurgo definitivo.

Uma pessoa que já foi autora pode continuar como orientadora, coorientadora ou examinadora de outros processos. A anonimização só pode ocorrer quando nenhum vínculo acadêmico ou prazo de guarda exigir sua identificação.

## Backup e restauração

Supabase e Drive têm ciclos de backup distintos; um não substitui o outro.

### Backup

- Ativar o mecanismo de backup compatível com o plano Supabase e registrar cobertura e retenção reais.
- Manter inventário dos IDs de arquivos do Drive, hashes e estrutura de pastas no Supabase.
- Exportar periodicamente configurações, modelos e matriz de variáveis, sem segredos.
- Cifrar qualquer cópia externa e limitar acesso ao Master e ao responsável designado.
- Registrar `RPO` (perda máxima de dados aceitável) e `RTO` (tempo máximo de recuperação) aprovados.

### Restauração assistida

1. Declarar incidente e congelar gravações.
2. Escolher ponto de restauração e preservar evidências.
3. Restaurar primeiro em ambiente isolado, nunca diretamente sobre produção sem ensaio.
4. Conferir contagens, referências, hashes dos arquivos e estados Asten/Gmail.
5. Reconciliar arquivos do Drive sem duplicar envelopes ou e-mails; usar chaves de idempotência.
6. Executar testes de acesso por processo e de ausência de acesso cruzado.
7. Promover a restauração, rotacionar segredos quando necessário e registrar a operação.

Teste de restauração recomendado: trimestral, usando dados sintéticos ou devidamente anonimizados. Um backup nunca testado não deve ser considerado recuperável.

## Resposta a incidentes

1. Revogar tokens Asten/Google e chaves Supabase potencialmente expostos.
2. Invalidar sessões do portal e suspender temporariamente downloads, se necessário.
3. Preservar logs sem ampliar a coleta de dados pessoais.
4. Identificar dados, titulares, período e provedores afetados.
5. Acionar o encarregado e o procedimento institucional para avaliar comunicações legais.
6. Corrigir a causa, rotacionar credenciais, testar e documentar a retomada.

## Checklist antes da produção

- [ ] Contratos, operadores, bases legais e temporalidade validados pela UFES.
- [ ] `SUPABASE_SECRET_KEY`/`service_role` ausente de arquivos `VITE_*`, navegador e logs.
- [ ] Tabelas com RLS forçada, sem grants para `anon`/`authenticated` e sem políticas amplas.
- [ ] Master e Presidente são os únicos administradores globais.
- [ ] Testes provam que participante acessa apenas os próprios processos e arquivos.
- [ ] Drive raiz e subpastas não estão compartilhados publicamente nem com o domínio.
- [ ] Publicação exige Termo assinado; retirada pública é imediata e auditada.
- [ ] Exportação, anonimização e revogação foram ensaiadas com dados sintéticos.
- [ ] Backup e restauração foram testados e têm RPO/RTO documentados.
- [ ] Plano de incidente, contatos e rotação de segredos estão atualizados.
