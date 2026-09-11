# Registro de alterações

## 1.0.0-rc.10 — 2026-09-10

- Revisão final para implantação: captura de falhas assíncronas, erros JSON e recuperação de telas React.
- Formulários adicionais validam tipos, escolhas, obrigatoriedade, limites e revisão; respostas ocultas são descartadas.
- Perguntas originais ficam registradas antes do Drive e são preservadas na retomada. Identificadores distinguem os autores dos envios.
- As quatro etapas nativas deixam de aparecer duplicadas nos formulários adicionais.
- Repetição da confirmação do local conserva a declaração original e a revisão dos dados.
- Cadastro, reserva, avaliação e entrega final distinguem salvamento de continuidade pendente; a interface não anuncia publicação antes da conclusão.
- Fonte e cores globais sincronizadas; cadastro numérico aplica limites também ao valor zero.
- Preâmbulo React do Vite autorizado por nonce em desenvolvimento, mantendo a política restrita no cliente compilado.
- Empacotamento ignora links simbólicos e metadados locais de implantação.
- Documentação consolidada e roteiro único em CHECKLIST_IMPLANTACAO.md.


## 1.0.0-rc.9 — 2026-09-10

- formulário do orientador integrado à tela e à API, com nota obrigatória de 0 a 10 e conferência explícita da revisão dos dados;
- bloqueio de avaliação antes da apresentação, de revisão desatualizada e de resultado não publicado;
- dados conferidos, responsável, data e respostas adicionais preservados no estado e no formulário arquivado;
- variáveis NOTA_FINAL, NOTA e AVALIACAO_NOTA disponíveis ao motor de documentos, sem nota fictícia em prévias;
- avaliação formal isolada do envio genérico de formulários para impedir caminhos paralelos;
- aparência global persistida, exceções antigas de tabelas e pop-ups eliminadas e controles de desvinculação retirados;
- 81 chamadas de mensagens, confirmações e preenchimentos substituídas pelo diálogo compartilhado do portal;
- instruções de instalação e continuidade por IA consolidadas na raiz; testes e limitações registrados em RELATORIO_VALIDACAO_RC9.md.

## 1.0.0-rc.8 — 2026-09-09

- cadastro inicial com rascunho privado, versionado, recuperável e expirável; mudança do formulário exige revisão pelo aluno;
- confirmação explícita do local com ator, data e comprovante PDF opcional arquivado de forma privada no Drive;
- amostra real dos quatro modelos pela conversão Google, com dados fictícios, marca d'água, expiração e análise de qualidade do PDF;
- comparação do rascunho do Estúdio com a revisão publicada, incluindo quantidade de TCCs ativos potencialmente afetados;
- Central de Andamento com filas de fluxo, formulários, Gmail, Asten e Drive, preservação de ações concluídas e retomada segura;
- calendário útil, feriados, prazos por marco e lembretes limitados, idempotentes e executados pela rotina diária autenticada;
- alertas de qualidade cadastral que não alteram automaticamente nomes, matrículas ou SIAPE;
- relatório institucional PDF com filtros, comparação, gráficos vetoriais, temas, áreas, tipos, finalidades, tempos, metodologia e proteção de grupos pequenos;
- regressão visual com captura responsiva, linha de base explicitamente aprovada e comparação por pixel;
- reforço das rotas de alteração: campos formais protegidos, documentos emitidos travando mutações tardias e reabertura de avaliação com justificativa;
- fluxo documentado integralmente do OTP à conclusão, incluindo pastas `Documentos`, modelos do Master, variáveis, Gmail e assinaturas Asten;
- dependências PDF fixadas, TypeScript limitado às fontes, build cliente/servidor separado e pacote de release determinístico.
- PDF.js atualizado para a linha corrigida 6.3.289 e `qs` fixado em 6.16.0; auditoria das dependências de produção sem vulnerabilidade conhecida nesta entrega.

## 1.0.0-rc.6 — 2026-09-08

- dois arquivos vivos mantidos pelo portal: memória contínua de fluxos/melhorias e panorama estatístico dos TCCs;
- atualização manual pelo Master e atualização diária no mesmo cron autenticado de manutenção;
- exatamente uma cópia ativa de cada arquivo em `00_SISTEMA/01_INTELIGENCIA_CONTINUA`, com novas revisões no próprio Google Drive;
- propostas baseadas em falhas, pendências, tempo sem movimentação, retrabalho e cobertura dos dados, sem alteração automática do fluxo de produção;
- decisão do Master preservada como proposta, aprovada, rejeitada ou implementada, com autenticação recente e auditoria;
- indicadores de volume, autoria, coautoria, conclusão, publicação, tempos, situação, resultado, formato, tipo, área, tema, finalidade e palavras-chave;
- campos canônicos de área, tema, tipo de estudo e finalidade adicionados ao modelo de formulário inicial e reconhecidos também em formulários personalizados;
- proteção estatística por agregação de categorias temáticas pequenas e exclusão de nomes, e-mails, matrículas, títulos e resumos;
- persistência transacional do estado da inteligência contínua no mesmo agregado Supabase e inclusão automática nos backups;
- painel administrativo com visão resumida, propostas governadas, download Markdown e acesso aos arquivos do Drive.

## 1.0.0-rc.5 — 2026-09-08

- convite executado integralmente pelo fluxo publicado pelo Master: modelo externo, PDF no Drive e e-mail configurado com anexo;
- respostas arquivadas dos formulários personalizados reaproveitadas como variáveis em todas as etapas posteriores;
- publicação do Estúdio bloqueada sem os quatro documentos obrigatórios e sem suas ações nos eventos seguros;
- retentativas de Asten e Gmail retomam o fluxo interrompido sem criar uma autorização paralela;
- downloads privados e dossiês usam transporte temporário privado no Supabase quando executados na Vercel;
- uploads para modelos e trabalhos só são consumidos após confirmação da persistência durável;
- PDFs recuperados do Drive passam por limite de tamanho e conferência do SHA-256 registrado;
- sessões reduzidas para duas horas, identificadas individualmente e revogadas no logout; cookie de produção com prefixo `__Host-`;
- proteção de origem para requisições mutáveis e webhook Asten persistido por lista branca de campos;
- runtime Supabase v6, outbox transacional Asten e nomenclatura de pastas Drive consolidados na interface, documentação e homologação;
- modelos documentais fixados por revisão e SHA-256, bloqueando alterações diretas no Drive sem nova publicação;
- destinatários de e-mail limitados aos papéis canônicos do processo e valores dinâmicos escapados no HTML;
- publicação de fluxo, troca Asten e modelos documentais protegidos por autenticação administrativa recente;
- limpeza diária autenticada do staging e dos downloads temporários por Vercel Cron, sem depender de tarefas iniciadas depois da resposta HTTP.
- tabelas novas usam 14 px como padrão global, preservando opções compacta, normal e ampliada no editor do Master;
- painel de modelos e Central Asten com texto e alvos de interação maiores, além de tratamento visual explícito para resultado ambíguo sem reenvio automático.
- `.env.local` carregado corretamente no desenvolvimento e artefatos de cliente/servidor separados, sem bundle da API ou sourcemap dentro do diretório público da Vercel.
- empacotamento realmente determinístico, sem datas variáveis em diretórios implícitos, e retirada de checklists históricos conflitantes do ZIP de implantação.
- conferência dos signatários e das ordens retornadas pela Asten antes de aceitar e arquivar o PDF assinado;
- Drive restrito à conta proprietária conectada e importação de modelos preexistentes por link desativada por padrão, sem ampliar silenciosamente o escopo OAuth;
- bloqueio de alterações de local, avaliação, reabertura ou exclusão que poderiam contradizer documentos externos já enviados;
- seleção de texto restaurada nas tabelas e primeira coluna herdando a aparência da própria linha.

## 1.0.0-rc.4 — 2026-09-04

- execução real das ações configuradas de documento, formulário e e-mail, com respostas do formulário propagadas para as variáveis da etapa seguinte;
- formulários liberados por etapa e papel, em vez de exposição indiscriminada em todos os processos;
- geração do convite pelo DOCX ativo, PDF anexado ao Gmail e repetição com o mesmo anexo;
- Asten com falha operacional refletida no fluxo, retomada idempotente e anexos finais somente após PDF assinado e arquivado no Drive;
- entrega final desbloqueada após a Ata, Termo condicionado a qualquer publicação e aviso de conclusão movido para `PROCESS_COMPLETED`;
- prioridade 1 simultânea para aluno(s) e orientador no Termo; Ata pelo orientador e Declaração pelo Presidente;
- fonte documental única no painel do Master e desativação da reestilização automática do DOCX;
- atualização das variáveis e dos quatro formulários padrão conforme o fluxo novo da Enfermagem;
- guia público opcional de replicação via GitHub, deixando explícito que esta instalação atende um único curso;
- atualização de permissões em cada requisição privada quando o Supabase durável está ativo, reduzindo janela de revogação em múltiplas instâncias Vercel;
- staging privado no Supabase para upload direto de DOCX e PDF por URL assinada de curta duração, com vínculo à sessão/finalidade, tamanho, MIME e SHA-256 antes do envio definitivo ao Drive;
- retirada de Base64 grande das requisições de produção da Vercel; o modo legado permanece restrito ao desenvolvimento e a arquivos pequenos;
- recuperação de formulários, e-mails e documentos interrompidos por falha de Drive/Asten, sem liberar a etapa seguinte antes do arquivamento obrigatório;
- modelos com marcadores não resolvidos são rejeitados antes da geração ou assinatura;
- troca de Master, recuperação administrativa e restauração de configuração preservam titularidade e exigem autenticação recente;
- metadados do Drive passam a vincular cada arquivo ao processo, tipo e trabalho de assinatura antes de permitir download;
- herança visual global corrigida: aparência compartilhada permanece vinculada, enquanto colunas, ordem e paginação continuam específicas de cada tabela;
- pop-ups operacionais passam a consumir os mesmos tokens visuais publicados pelo Master;
- empacotamento reproduzível, sem credenciais, dependências instaladas, estado local ou artefatos de execução.

## 1.0.0-rc.3 — 2026-09-02

- pacote operacional por curso atualizado para schema 3, com validação e publicação atômica de aparência, documentos externos, e-mails, formulários, variáveis e fluxo;
- prontidão por área, bloqueio de publicação inválida, histórico, comparação e restauração de versões;
- formulários dinâmicos por papel no processo, com campos condicionais, validação no navegador e no servidor, revisão, checksum, PDF no Drive e auditoria;
- eventos personalizados de formulário e condições de execução nas ações do fluxo;
- design system publicado, contraste mínimo, foco visível, alvos de interação e preferência de movimento reduzido;
- central de notificações, feed ICS, ensaio de backup, retenção com guarda legal, solicitações LGPD e saúde operacional;
- histórico e restauração dos vínculos versionados de modelos documentais;
- idioma e fuso configuráveis por curso, com mensagens essenciais dos formulários em português, inglês e espanhol;
- testes estáticos de acessibilidade incorporados ao CI;
- nenhuma credencial externa ou conteúdo DOCX incorporado ao pacote.

## 1.0.0-rc.2 — 2026-09-02

- instalação independente por curso, com identidade, domínios, períodos e protocolo configuráveis;
- administração global limitada ao usuário Master e ao Presidente da Comissão;
- lista de alunos com importação CSV/XLSX e autorização automática dos participantes do TCC;
- limite de um TCC de graduação por autor, sem limitar outros papéis acadêmicos;
- aceite de coautoria, detecção de conflitos e auditoria pesquisável;
- Asten como assinatura exclusiva, com envio direto pelo botão do documento;
- termo condicional à publicação e assinatura simultânea de aluno(s) e orientador;
- Google Drive privado com modelos externos, nomes padronizados e arquivamento de formulários, trabalhos e assinados;
- Supabase v4 transacional, migrações normalizadas e bloqueio de produção sem persistência durável;
- personalização publicada no servidor, herança global real e sobrescritas individuais;
- Estúdio executável de modelos, e-mails, formulários, variáveis e fluxo;
- Tutorial alimentado pelo fluxo publicado no Estúdio;
- dossiê institucional, autenticidade pública, transferência administrativa, indicadores e feature flags;
- documentação de instalação, segurança, homologação, atualização e contribuição aberta.
