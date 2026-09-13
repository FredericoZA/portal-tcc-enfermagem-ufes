# Fechamento técnico — 13/09/2026

Esta rodada consolidou as pendências conhecidas de código, configuração, interface e higiene do repositório antes do piloto operacional.

## Concluído no código e na interface

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
- tutorial público unificado em uma única implementação canônica;
- texto do tutorial alinhado ao contrato público: matrícula, e-mail, SIAPE, IDs internos e vínculos privados do Drive não são dados anônimos;
- avaliação documentada de acordo com o fluxo atual: resultado e parecer, sem nota numérica;
- documentação de implantação atualizada;
- testes de regressão adicionados para os contratos desta rodada.

## Higiene do repositório

A segunda auditoria encontrou automações de correção pontual que haviam ficado disponíveis para execução manual mesmo depois de sua finalidade ter sido incorporada ao código. Foram removidos:

- `.github/workflows/canonicalize-public-policy.yml`;
- `.github/workflows/final-p0-contract-fix.yml`;
- `scripts/canonicalize-public-policy.mjs`;
- `scripts/final-p0-contract-fix.mjs`;
- `scripts/finalize-canonical-cleanup.mjs`.

Esses artefatos faziam alterações textuais e commits automáticos em `main` e não pertenciam à operação permanente. Permanecem somente os workflows persistentes de CI e Production smoke.

## Homologação vigente

Foi criado `docs/HOMOLOGACAO_ATUAL.md` como roteiro canônico de go-live. Os arquivos `HOMOLOGACAO_RC*.md` passam a ser tratados apenas como registros históricos das respectivas versões. `CHECKLIST_IMPLANTACAO.md` e `PROXIMA_RODADA.md` apontam para o roteiro vigente.

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
