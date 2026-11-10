# Carregamento e persistência do Portal — 7 de novembro de 2026

## Evidência atual

A captura do cadastro contém a mensagem de falha de inicialização do worker, classificada como SUPABASE_RUNTIME_STATE_ERROR. Os logs também confirmaram falhas atuais na versão 88fbd2e, não apenas uma mensagem antiga no navegador.

Uma consulta pública a /api/settings retornou RUNTIME_BUSY após 5,13 segundos. Esse código identifica espera esgotada na fila da instância, não demonstra sozinho falha de inicialização. No mesmo período, os logs do banco registraram cancelamento SQL 57014 em leituras de snapshot e commits completos. A resposta específica da captura não foi correlacionada a um request ID.

O agregado operacional continha aproximadamente 4,43 MB: 2,54 MB de auditoria, 895 KB de registros legados e 593 KB de versões de configuração. O cadastro em si representa uma fração pequena. Esses números descrevem JSON de estado e histórico; não indicam que os PDFs passaram a ser guardados no banco.

## Correções delimitadas

1. Recuperação de uma interrupção real de transporte durante a leitura ou o recebimento do corpo. Uma única recuperação e prazo total compartilhado de 30 segundos, com limite de tentativas por URL. Falha de permissão, JSON inválido e estado/revisão inválidos continuam bloqueando a operação. Não se autoriza por cache antigo e não se repetem gravações.
2. Consulta de configurações reaproveita a recuperação já existente para RUNTIME_BUSY: uma única tentativa adicional, respeitando Retry-After e troca de identidade. Chamadas simultâneas continuam compartilhando a mesma leitura.
3. Rodapé distingue informação indisponível de configuração recebida e vazia. Falha de carregamento não vira “Não configurado”.
4. Projeção de auditoria deixa de tentar inserir IDs históricos já presentes na tabela append-only. A seleção conserva a ordem original para IDs novos duplicados. ON CONFLICT permanece como barreira final. Nenhuma outra projeção, autorização ou processo é filtrado.

IDs de auditoria já armazenados são imutáveis: novas cópias desses IDs não reescrevem a evidência histórica. Eventos novos inválidos continuam causando falha e rollback. A otimização conserva owner, ACL, modo de segurança e search_path da função instalada, sem introduzir concessões novas.

## Limites da conclusão

Retentativa de transporte não é uma correção dos cancelamentos SQL. A otimização da auditoria reduz trabalho repetido, mas sua medição local não certifica latência ou capacidade de produção. A fila continua protegendo o estado compartilhado. Nenhuma espera foi artificialmente aumentada e nenhum fluxo foi liberado para testes.

A instalação, publicação e verificação real devem ser registradas no comprovante da revisão após execução. A eliminação completa da lentidão depende da observação das requisições reais depois da publicação; não deve ser declarada somente pelos testes locais.

## Instalação confirmada

Migração 20261107205937 instalada no projeto oficial. A conferência encontrou o seletor otimizado, a ordem original do lote e as permissões anteriores preservadas. A auditoria e a revisão avançaram durante atividade simultânea do usuário; a migração executada altera somente a função e não grava dados de processo.
