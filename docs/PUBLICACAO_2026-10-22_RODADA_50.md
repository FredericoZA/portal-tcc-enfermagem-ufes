# Publicação de 22/10/2026 — rodada 50

Publicação solicitada pelo usuário após a revisão de e-mails, documentos e manual.

- Domínio: https://portal-tcc-enfermagem-ufes.vercel.app/
- Implantação: dpl_7YNZYEYMaEKPCEfmDpsJx2shPBSc
- URL imutável: https://portal-tcc-enfermagem-ufes-2ahtwsq7u-tcc-enfermagem.vercel.app
- Projeto: prj_Au1sh3Ukf9vlLqBtGnDpsoiS1GtZ; equipe tcc-enfermagem.
- Estado READY e alias oficial conferidos na CLI e no conector Vercel.
- Pacote: 526 arquivos, manifesto SHA-256
  8d3cdf41c0cca59be177f5248078b39ebc00517661e6e1f8012ce7cd5d5d380b.
- Publicação direta do conteúdo local preservado. Nenhum push/commit foi
  realizado; o HEAD Git 0e392dd não representa sozinho estas alterações locais.

## Validação executada

- test:ci: segredos, TypeScript, 640 testes unitários/contratos locais,
  17 contratos de integração, acessibilidade estática, finalização, build,
  smoke HTTP. Todos aprovados.
- test:secure-flow: 40 aprovados, zero falhas.
- npm audit: zero vulnerabilidades.
- Build remoto: npm ci e compilação concluídos; quatro funções em gru1.
- Navegador local: fichário dos quatro perfis, navegação por teclado,
  etapas, cartões disponíveis/indisponíveis e capturas atuais demonstrativas.
- Banco oficial: revisão 251, somente proc-1792437108150, estado
  AGUARDANDO_DADOS_FINAIS; mesma revisão antes e depois da publicação.
- RLS habilitado em todas as tabelas públicas. Inbox Asten sem política pública
  gera aviso INFO e permanece destinado ao servidor.
- Funções portal_bound_upload_allocations e portal_bound_download_allocations
  presentes no banco oficial.
- 00_SISTEMA consultado pelo conector Drive; padrão visual permanece no local.
  Destinos técnicos separados configurados no pacote de produção.

## Limites da conferência

A validação visual ocorreu localmente. A publicação foi confirmada pelo estado
READY e alias no provedor; não houve novo ciclo real de e-mail, download de
arquivo oficial ou assinatura em produção. Não foram enviados e-mails nem
criados envelopes para testar. A conferência não equivale a uma auditoria
exaustiva de segurança nem a uma nova homologação integral Drive/Gmail/Asten.

A base auxiliar manual-round50 foi removida e seu servidor encerrado. O
localhost principal e sua base demonstrativa foram preservados. Segredos,
.portal-data, dados demonstrativos e resultados locais não integraram o pacote.
As imagens do manual contêm apenas exemplos, identificados como demonstração.
