# Conferência de segurança e funcionamento — rodada 52

Revisão de 22/10/2026 dos ajustes de interface, reautenticação, destinatários e
assinatura Gov.br acumulados após a rodada 51. Não é auditoria exaustiva nem
homologação externa de Google, Asten ou certificados Gov.br.

## Resultado e limites

Não foram identificadas novas vulnerabilidades confirmadas no escopo revisto.
A auditoria npm das dependências de produção retornou zero vulnerabilidades
conhecidas. Testes locais com base isolada e navegador com APIs interceptadas
não enviaram e-mails, não criaram envelopes reais nem mudaram o processo oficial.

## Barreiras conferidas

- Upload Gov.br exige sessão recente, acesso ao TCC, titularidade aplicável,
  revisão atual e signatários correspondentes ao cadastro. A aprovação exige
  administrador e nova confirmação recente. Rotas em server.ts, seção
  /api/signatures/jobs/:id/govbr.
- server/integrations/govbrManualReview.ts verifica hash do original, limite de
  50 MB, estrutura do PDF, páginas/conteúdo e assinatura digital incorporada
  cobrindo o arquivo. Imagem de assinatura e PDF original sem assinatura não
  satisfazem essa barreira.
- Verificação estrutural não atesta validade criptográfica nem identidade do
  titular. A secretaria precisa conferir todas as assinaturas no VALIDAR/ITI,
  titulares, conteúdo e versão. O hash do PDF e as confirmações são exigidos
  pelo servidor; aprovação e arquivamento ficam auditados. Não se deve apresentar
  um arquivo apenas enviado como já aprovado ou arquivado.
- Ata usa orientador, Termo usa todos os autores e orientador e Declaração usa
  commissionPresidentEmail. O destinatário Master não substitui esses papéis.
  Vínculos em server/workflow/signaturePolicy.ts.
- Troca de Master/Presidência mantém autenticação recente e aceite do novo
  titular; a correção de interface não escreve esses e-mails no PATCH comum.
- Imagens preservam a exigência de autenticação recente. A confirmação usa OTP
  existente e repete apenas o salvamento daquela imagem, uma única vez.
- Indicador de carregamento continua sem capturar cliques; confirmação OTP e
  upload permanecem acessíveis enquanto a operação está pendente.
- Pacote de publicação exclui .env.local, credenciais, dados .portal-data e
  saídas de testes. Simulador permanece bloqueado no ambiente de produção.

## Verificações executadas

- test:ci: 652 testes principais, 17 contratos, TypeScript, segredos,
  acessibilidade estática, finalização, build e smoke HTTP aprovados.
- test:secure-flow: 40 aprovados, zero falhas.
- npm audit --omit=dev: zero vulnerabilidades conhecidas.
- Navegador: fichário do manual sem espaços entre abas, fundo uniforme, imagem
  reduzida e navegação por teclado; observação de assinatura recolhida no editor
  e abaixo do infográfico público; preparação Gov.br com envio destacado.
- Demais verificações de salvamento, reautenticação e cartões constam em
  AJUSTES_PENDENTES_PUBLICACAO_2026-10-22.md.

O build informa alguns módulos JavaScript acima de 500 kB; é uma oportunidade
futura de otimização de carregamento, sem falha de compilação. A comprovação
real de recebimento de e-mails e assinaturas pelos provedores continua dependendo
 do teste de ponta a ponta com os titulares.
