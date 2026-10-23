# Publicação de 22/10/2026 — rodada 52

Publicação autorizada pelo usuário para concluir as correções acumuladas após a
rodada 51 e liberar teste completo de ponta a ponta.

- Domínio oficial: https://portal-tcc-enfermagem-ufes.vercel.app/
- Deployment: dpl_J4qmHVPLNr5V1i5FtNKYFQLgQPqJ
- URL imutável: https://portal-tcc-enfermagem-ufes-kdff7jk6j-tcc-enfermagem.vercel.app
- Provedor confirmou READY, target production, região das funções gru1 e domínio
  oficial vinculado, sem aliasError. Confirmação feita pela CLI e conector Vercel;
  não foi realizado teste HTTP nem operação autenticada em produção após deploy.
- Fonte: 541 arquivos, manifesto SHA-256
  84ff31edcdb016d5c7b84dbb7ed4cea45016157aadcafe8fc6ece8cb9e745ddf.
- Pacote isolado .portal-data/release-round52; manifesto em
  .portal-data/review52/source-manifest.json. Readback dos arquivos confirmou zero
  diferenças entre manifesto, pacote e fontes no momento da publicação.
- Git local work/desenvolvimento-local; HEAD e origin/main após fetch permanecem
  em 0e392dd4dee31d44ce2d6b12e2ddc21915450fdf. A publicação contém mudanças locais
  posteriores e não equivale a commit/push no GitHub. Não foi feito push.

## Ajustes incluídos

- Gov.br: confirmação OTP na janela e retomada da preparação; área de devolução
  do PDF mais evidente. Mantidas validação estrutural e conferência manual ITI.
- Imagens de formulários/e-mails: confirmação de acesso recente e retomada do
  mesmo envio uma única vez, sem sair do Portal.
- Rodapé e Identidade: rascunho sensível preservado, transferências pendentes
  visíveis/canceláveis e salvamentos comuns sequenciais sem perder nova edição.
- Carregamento global centralizado; cartões documentais com provedores acima
  da linha Ver/Baixar, verde já usado no site e mensagem Não autorizado enxuta.
- Repositório: linhas compartilhadas entre uploads e escolhas de publicação,
  incluindo espaço reservado quando um arquivo opcional não foi enviado.
- Modelos de e-mail ordenados conforme pedido; catálogo de Fluxos acompanha.
- Três linhas Asten/Gov.br no editor ligadas às ações existentes, destinatários
  por função e inclusão restrita à etapa correta. Sem criar envios duplicados.
- Explicação de assinaturas recolhida no editor; na página pública fica abaixo
  do infográfico. Ata/orientador, Termo/autores+orientador, Declaração/presidência.
- Como usar: imagens reduzidas pela metade, abas contíguas em toda a largura,
  mesma superfície da folha, sem separação horizontal. Perfis/teclado preservados.

## Verificação

- test:ci: 652 testes principais, 17 contratos, TypeScript, segredos, acessibilidade
  estática, finalização, build e smoke HTTP aprovados.
- test:secure-flow: 40 aprovados, zero falhas.
- Auditoria npm das dependências de produção: zero vulnerabilidades conhecidas.
- Scanner de segredos aplicado a todos os 541 arquivos do pacote: aprovado.
- Navegador local: mudanças de interface, perfis, seleção e etapas; OTP, uploads
  e gravações lentas foram testados com respostas interceptadas quando necessário.
- Build remoto, funções e associação do domínio concluídos na Vercel.
- Revisão delimitada de segurança em REVISAO_SEGURANCA_RODADA_52.md.

## Limites e preservação

Não foram alterados responsáveis reais, arquivos oficiais, documentos assinados,
modelos originais ou credenciais de produção durante os testes. O pacote não
contém dados demonstrativos operacionais nem .env.local. Nenhuma migração ou
reenvio retroativo de mensagens/assinaturas foi executado por esta publicação.

A conferência Gov.br no código é estrutural. Validar criptografia, titulares e
cadeia de confiança exige o resultado oficial VALIDAR/ITI e confirmação manual.
Testes com PDFs artificiais e respostas simuladas não homologam assinatura real.
O recebimento de e-mails e as integrações reais ainda precisam do teste dos
participantes. A revisão realizada não é auditoria exaustiva do repositório.
