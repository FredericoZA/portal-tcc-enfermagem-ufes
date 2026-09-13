# Fechamento técnico — 13/09/2026

Esta rodada consolidou as pendências conhecidas de código, configuração e interface antes do piloto operacional.

## Concluído no código

- botão redundante “Acessar o Portal” removido do guia;
- transferência administrativa da Presidência desacoplada de feature opcional, preservando autenticação e reautenticação de segurança;
- gestão da Comissão reorganizada, com ações padronizadas, integrantes e QR Code automático do WhatsApp;
- símbolo do curso configurável em PNG transparente 1024 × 1024 px, até 1 MB, exibido sem recorte ou deformação;
- cabeçalho mantido com emoticon acadêmico;
- bloco redundante “Central segura de integrações” removido;
- ativação inicial simplificada;
- Monitor operacional movido para Indicadores;
- autorização de acesso reorganizada em tabela e blocos de ação;
- observação redundante do Drive removida;
- paleta verde principal migrada para verde militar/oliva fosco;
- documentação de implantação atualizada;
- testes de regressão adicionados para os contratos desta rodada.

## Verificação da conta institucional

Os quatro modelos ativos foram localizados diretamente no Google Drive conectado e tiveram o conteúdo lido nesta revisão:

- `MODELO_ATIVO_CONVITE`;
- `MODELO_ATIVO_ATA`;
- `MODELO_ATIVO_TERMO`;
- `MODELO_ATIVO_DECLARACAO`.

Os quatro também foram exportados com sucesso pelo Google Drive para PDF, comprovando que os documentos ativos existem e são renderizáveis. A substituição das variáveis com dados de um processo real continua pertencendo ao piloto ponta a ponta.

## Evidência automatizada exigida

A entrega de código somente é considerada publicada quando CI, Vercel e Production smoke aprovarem o mesmo commit de `main`.

## Pendências externas ao código

Estas ações não podem ser simuladas nem consideradas concluídas sem a credencial Asten e a execução acadêmica real:

1. conectar/validar a conta Asten e o callback, caso o painel ainda aponte pendência;
2. executar o piloto real ponta a ponta com usuários de teste autorizados, incluindo geração dos quatro documentos com variáveis preenchidas;
3. registrar as evidências de Gmail, Drive, Asten, assinaturas, publicação/retirada e retomada de falha.

Até essas evidências existirem, a homologação acadêmica ponta a ponta permanece **não confirmada**, mesmo com o site e os testes automatizados em produção.