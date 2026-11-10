# Revisão noturna do Portal TCC — 08/11/2026

Base de produção conferida no início: `020cda7eda826411ada18d75580d6b32ddd14d5a`, deployment `dpl_2idDPS2AV38UbbNDA7yJakyX3qVP`, domínio oficial `portal-tcc-enfermagem-ufes.vercel.app`. A implementação usa o worktree de revisão; o diretório de trabalho principal, seus dados e credenciais foram preservados. A publicação final tem prova separada com commit e alias exatos.

## Correções e evidências

| Frente | Defeito confirmado | Correção | Verificação e limite |
|---|---|---|---|
| Persistência | Uma barreira durável repetida reenviava o estado completo e incrementava a revisão mesmo sem alteração. | Compara o estado canônico e confirma a revisão atual no banco; se não há mudança, evita o commit. Revisão diferente, falha de leitura e mudança de endpoint continuam bloqueando o sucesso. | Testes de CAS, erro de leitura, auditoria real e ACK perdido. A alteração não dispensa salvar mudanças reais e não modifica permissões. |
| Fila de exclusão | Fila vazia consultava a API a cada minuto; respostas tardias podiam sobreviver à troca de identidade. | Consulta inicial, atualização por evento/visibilidade, intervalo somente com tarefa pendente, coalescência e descarte por identidade/época. | Dez minutos sem alterações: 11 consultas antes, 1 depois; fila pendente mantém as consultas. Não é medida de faturamento. |
| Logs | Tarefa COMPLETED era descrita como limpeza pendente. Incidentes de assinatura tinham pouco contexto e rótulo Error em inglês. | Apresentação administrativa com resultado e referência da operação; tradução do erro, estados de solicitação, assinatura e arquivamento distintos. | Projeções e rotas de logs/retomada testadas. Dados históricos preservados. Não se confirmou recebimento Gmail apenas por resposta de aceitação. |
| Indicadores | Panorama contava rascunhos, inventava duração pela data de edição e deduzia semestre pela data da defesa. | Regras compartilhadas de cadastro submetido, defesa ocorrida e duração documentada; período declarado ou ciclo explícito. | Comparação entre construtores sobre a mesma fixture; fonte histórica desconhecida não foi preenchida. Relatório avançado tem recorte de atuais, distinto do painel com legados. |
| Repositório | Registros sem data passavam por intervalos explícitos; repetição da mesma identidade podia duplicar a projeção. | Filtro comum das listas pública e privada, com dia de São Paulo para atuais e civil para legados; deduplicação só comprovada na projeção. | Testes HTTP para visitante, participante e Master; fontes imutáveis, rascunhos e arquivos privados protegidos. Conflitos de conteúdo ou IDs diferentes são preservados. |
| Textos e manual | Asteriscos ainda eram exigidos em outro local; documentos descreviam ASTEN manual e três assinaturas. | Siglas automáticas com compatibilidade das entradas antigas; guia, fluxo e manual atualizados para envio automático, destinatários e até seis assinaturas. | Manual de 20 páginas renderizado nas páginas alteradas; capturas antigas ainda precisam de atualização e o aceite integral de 017.07 permanece aberto. |
| Teclado | Tab podia sair de uma janela customizada ainda aberta. | Contenção na janela visível de topo, preservando Escape, retorno de foco e diálogo nativo aninhado. | Testes de Tab/ShiftTab, summary, rádio, controles ocultos e janelas aninhadas; não equivale a auditoria completa com leitor de tela. |

## Medição de consumo e sincronização

Uma comparação controlada executou o código anterior e o corrigido, com duas instâncias independentes e os mesmos 60 salvamentos sem alteração e 60 consultas de outra instância. O estado sintético tinha 3.968.420 bytes. Antes ocorreram 60 commits e 60 leituras completas: 238.107.591 bytes de corpos enviados e 238.107.996 bytes de respostas. Depois ocorreram zero commits e zero leituras completas; 120 consultas de revisão retornaram 1.920 bytes. Os dados lidos permaneceram iguais.

Essa comparação mede o mecanismo sob transporte HTTP simulado; não mede latência de produção, CPU do Postgres, custo faturado ou capacidade garantida para 60 usuários. O ganho decorre de evitar uma invalidação sem mudança real, sem armazenar respostas privadas indefinidamente nem ignorar a revisão do banco.

Consulta somente leitura ao Supabase oficial: revisão 1205, um processo atual, 108 legados, IDs/protocolos distintos em ambos os conjuntos; nenhuma tarefa de exclusão pendente e nenhum processo normalizado CANCELLED. Não houve limpeza ou renumeração nesta revisão.

Os logs reais de 01:45 a 02:45 UTC de 08/11 confirmaram lentidão também no transporte/leitura inicial: 70 respostas 200 da RPC de snapshot serializado com média de 3.687,7 ms e oito respostas 500; cinco commits completos 200 com média de 6.579 ms. Essa janela identifica caminhos caros, mas não é uma janela equivalente após a correção. O efeito real sob a mesma carga e o consumo faturado continuam não confirmados.

Leitura de metadados do banco também gera egress, mesmo com PDFs no Drive: [documentação do Supabase](https://supabase.com/docs/guides/platform/manage-your-usage/egress). Não há promessa de armazenamento ou operação gratuitos por cem anos. Não foram alterados planos, limites, assinaturas, credenciais, RLS ou esquema do banco.

## Checklist e continuação

As matrizes de 169 e 324 caixas continuam separadas. Cada fechamento registra o escopo observado; correção de código, teste simulado, publicação e aceite externo não são equivalentes. A contagem final e a relação individual das caixas restantes são regeneradas depois dos checks e da publicação.

Continuam separados: assinaturas dos titulares, recebimento nas caixas reais, Gov.br adiado, estados dos quatro envelopes históricos, comprovação dos arquivos/ACLs no Drive, datas históricas e inspeção visual integral. Nenhum processo acadêmico foi criado, apagado, reaberto ou liberado artificialmente nesta revisão. A recuperação dos legados segue o [roteiro adiado](RECUPERACAO_LEGADOS_ADIADA.md).

## Recuperação da versão anterior

Não houve migração ou alteração dos dados de produção neste lote. Os commits são separados por frente. Para reverter a publicação, a referência anterior é o deployment `dpl_2idDPS2AV38UbbNDA7yJakyX3qVP`; restaurar o código não exige desfazer dados nem credenciais. Os testes de persistência preservam os backups e recusam conflitos de versão. Alterações já gravadas por usuários não devem ser sobrescritas por um snapshot antigo.

## Falha real identificada na conferência da publicação

Depois do primeiro lote `eaa5e51f`, a abertura anônima do domínio oficial reproduziu 503 nas consultas iniciais de configurações, processos e calendário. Os logs Vercel registraram `CREATE_APP / SUPABASE_RUNTIME_STATE_ERROR / SUPABASE_57014`. A revisão canônica e a projeção wire do banco estavam ambas em 1205: não era divergência de versão. A leitura da RPC de inicialização expirava e o código encerrava sem tentar a tabela canônica atual; o caminho de atualização de uma instância já inicializada tinha recuperação equivalente.

A correção permite uma leitura da mesma linha canônica atual após `57014` ou falha transitória de transporte/gateway, dentro do orçamento compartilhado de 30 segundos. Não aceita cache antigo, acesso negado, payload inválido nem erro explícito de projeção obsoleta. Não repete gravações. Se a leitura canônica também falhar, mantém o erro seguro. O conjunto dirigido passou em 36 testes; a nova publicação e a navegação pública têm prova separada. Isso trata a falha de recuperação, sem alegar eliminação da lentidão do banco ou homologação dos provedores.

A mesma conferência identificou o rodapé preso no erro inicial, mesmo após a recuperação de outras consultas. A leitura pública de configurações agora tem uma retentativa limitada, com Retry-After e invalidação pela revisão da sessão. Não repete erros permanentes/cancelamentos nem multiplica a retentativa de admissão já existente no cliente. Os 17 testes dirigidos incluem a recuperação da configuração e os controles de identidade anteriores.

## Conferência específica de leitura

O critério 010.06 foi exercitado em Informações gerais, na seção Quando realizar o TCC, com teclado e larguras de 390 e 1440 pixels. O link curricular usava a cor de ação clara e tinha contraste de 3,88:1; passou a usar o verde de cabeçalho já definido no tema, com contraste medido de 6,39:1. O layout e o tamanho foram mantidos. Essa evidência específica não encerra a inspeção integral de todas as telas e perfis de 031.
