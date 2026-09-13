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

## Evidência automatizada exigida

A entrega somente é considerada publicada quando CI, Vercel e Production smoke aprovarem o mesmo commit de `main`.

## Pendências externas ao código

Estas ações não podem ser simuladas nem consideradas concluídas sem as contas reais:

1. conectar/validar a conta Asten e o callback, caso o painel ainda aponte pendência;
2. conferir os quatro DOCX oficiais na conta institucional;
3. executar o piloto real ponta a ponta com usuários de teste autorizados;
4. registrar as evidências de Gmail, Drive, Asten, documentos, publicação e retomada de falha.

Até essas evidências existirem, a homologação acadêmica ponta a ponta permanece **não confirmada**, mesmo com o site e os testes automatizados em produção.
