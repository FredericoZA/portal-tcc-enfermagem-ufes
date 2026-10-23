# Revisão de 21/10/2026 — rodada 21

## Implementação

- Ficha em duas caixas cinza médio: dados do trabalho em duas linhas e participantes centralizados.
- Dados gerais e convite; confirmação do local em seção própria, seleção dos locais publicados e comprovante obrigatório.
- Prévia da ata disponível antecipadamente; registro oficial mantém local, convite, horário, revisão e autorização obrigatórios.
- Cards do repositório cinza médio, campos brancos, salvar no acervo ao final.
- Links por processo e seção, preservados durante autenticação; aba inicial acompanha a etapa, com navegação manual possível.
- E-mails individualizados, data e hora legíveis em São Paulo, orientação de acesso por papel, Comissão Examinadora e local confirmado.
- Demonstrativo de modelos envia data de máquina, corrigindo erro de data por extenso no botão de olho.
- Arquivamento sem pasta de ano, sem pasta de protocolo dentro de Gerados/Assinados e sem ciclo Assinados da carta-convite.
- Publicação nova usa o próprio PDF privado do processo, com hash conferido e download autorizado pelo Portal; não cria cópias nem permissões públicas no Drive.

## Verificações

- TypeScript aprovado.
- Suíte geral: 598 testes, 597 aprovados inicialmente; única falha era expectativa de quatro pastas na raiz. Teste atualizado para três pastas, sem pasta de repositório e sem Assinados de convite; os quatro testes desse arquivo passaram na repetição.
- Teste específico de publicação privada aprovado, verificando ausência de escrita/cópia/permissões e rejeição de hash divergente.
- Contratos de provedores, acessibilidade, finalização, build e smoke HTTP aprovados.
- Fluxo seguro: 40 aprovados, zero falhas.
- Navegador local isolado: etapa Convite e Banca abriu em Avaliação & Ata; PDF demonstrativo renderizado antes da defesa, confirmação bloqueada pelo horário; voltar e corrigir funcionou. Dados gerais e repositório conferidos visualmente.
- Evidências em output/revisao-2026-10-21-rodada21/.

## Drive executado

- TCC-2026-0001 e os dois pilotos movidos de 02_PROCESSOS/2026 para 02_PROCESSOS, preservando os IDs.
- Carta-convite movida da subpasta TCC-2026-0001 para 02_GERADOS, preservando seu ID.
- PDF público de piloto preservado e movido de 03_REPOSITORIO_PUBLICO para 08_PUBLICACAO do respectivo processo.
- Nenhum documento ou dado de teste excluído.
- Quatro pastas redundantes foram removidas da estrutura ativa: ano 2026, protocolo de Gerados, Repositório Público e Assinados de Convite. O conector recusou exclusão definitiva por insufficientFilePermissions. Pelo navegador, a conta do portal pôde mover as duas pastas próprias para a lixeira normal do Drive e remover as duas pastas compartilhadas vazias da estrutura. Nenhuma permissão foi alterada; não foi esvaziada a lixeira nem criada subpasta de lixo.

## Limites

- Testes locais não comprovam entrega futura de e-mail institucional. Retorno 550 5.7.1 evidencia política do domínio; não comprova relação com números ou aliases no endereço.
- A prévia local usa renderer fictício isolado, sem Gmail/Asten/Drive reais.
- Publicação concluída e promovida para https://portal-tcc-enfermagem-ufes.vercel.app/ em 21/10/2026. Implantação dpl_BayjEypgCg716bxFK1WMNmVkn16E, estado READY. URL imutável: https://portal-tcc-enfermagem-ufes-gtrpya1du-tcc-enfermagem.vercel.app/. Asset observado no DOM do endereço oficial: /assets/index-BESTCWC-.js. Dez verificações reais do preflight aprovadas (banco original, dados da amostra, Drive, quatro modelos, conexão/pastas/fila Asten). No site oficial, TCC-2026-0001 abriu em Avaliação & Ata na etapa Convite e Banca, mantendo bloqueio de preenchimento ao visitante. Sem envio de e-mail real ou despacho de assinatura nesta rodada.
