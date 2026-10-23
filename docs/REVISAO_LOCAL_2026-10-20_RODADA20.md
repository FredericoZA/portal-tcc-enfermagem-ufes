# Revisão local — comentários 1 a 19 e falhas de PDF

Esta rodada foi implementada e validada localmente. Não foi publicada na Vercel, nem houve push, merge ou exclusão de dados de teste ou de produção.

## Alterações

- As quatro abas do detalhe têm larguras iguais e bordas alinhadas. A primeira chama-se Geral; Documentos oficiais do processo traz seu título na própria aba.
- Geral reúne os dados do trabalho, a data de registro e todos os participantes. Examinadores aparecem depois do orientador e antes do coorientador; duplicações históricas do orientador na banca não se repetem na apresentação.
- Autores e orientador podem corrigir dados antes do convite. O servidor preserva o vínculo do usuário, valida participantes e mantém os bloqueios por documentos emitidos e assinatura ativa.
- A confirmação dos dados e do local usa fundo cinza médio e campos claros. O empacotamento da função Vercel inclui o worker PDF.js exigido para ler o comprovante; a validação do PDF continua obrigatória.
- As amostras de modelos recebem data canônica válida mesmo quando o Estúdio personaliza seu campo como texto. Os dados são fictícios, sem gerar um processo oficial; a versão demonstrativa recebe marca de amostra.
- A avaliação exibe somente Aprovado, Aprovado com ressalva e Reprovado, incluindo configurações antigas com faixas numéricas. As sugestões de parecer são maiores, variam e evitam repetição consecutiva; continuam editáveis.
- Os avisos da avaliação formam uma caixa amarela. Títulos internos repetidos foram removidos, e o botão da sugestão fica dentro do campo.
- A conclusão da avaliação exige Visualizar ata e confirmação explícita ao final da prévia. A autorização assinada pelo servidor vincula ator, respostas, provedor, revisão dos dados e modelo; expira em 30 minutos. Alterações exigem nova prévia. Gerar uma prévia não conclui a avaliação nem solicita assinatura.
- Somente Master e orientador cadastrado têm acesso ao formulário e às APIs de avaliação. Asten e Gov.br permanecem disponíveis. No Gov.br, após a confirmação, o fluxo abre preparação, download e devolução do PDF; o upload não substitui a conferência administrativa por hash/revisão no VALIDAR/ITI.
- O repositório apresenta resumo em largura total, cinco campos de palavras-chave, trabalho completo e resumo expandido, nessa ordem. O resumo aceita até três parágrafos e 2.000 caracteres. Salvar no acervo permanece exclusivo do Master; a entrega final dos autores mantém sua ação própria.
- O convite é identificado como disponível após a confirmação da reserva, sem assinatura. A mensagem de reserva inclui orientação aos autores para confirmar e anexar o comprovante no Portal.
- A atribuição indevida abaixo do WhatsApp foi removida. O guia textual acompanha os novos nomes e a conferência da Ata.

## Verificação

- `npm run test:ci`: 588 testes de unidade, 17 contratos, verificações estáticas de acessibilidade/finalização, scanner de segredos, compilação e smoke HTTP aprovados.
- `npm run test:secure-flow`: 40 verificações aprovadas.
- Após o último ajuste de apresentação do repositório: TypeScript e compilação aprovados.
- Navegador local: alinhamento e rótulos das abas, dados e membros na Geral, aviso único da avaliação, três resultados e cinco campos de palavras-chave confirmados.
- Regressões específicas cobrem PDF real, inclusão do worker no empacotamento, data da amostra, prévia obrigatória e sua invalidação, permissões, rótulos e variação do parecer.
- A compilação conserva o aviso de chunks maiores que 500 kB.

## Limites e próxima publicação

A leitura de um comprovante dentro da função Vercel e a prévia dos modelos oficiais com Google Drive precisam ser confirmadas no ambiente publicado. Os testes locais não comprovam uma assinatura pessoal real nem o aceite acadêmico de uma defesa. Não houve assinatura, confirmação de resultado ou envio de e-mail de produção nesta rodada.

Os dados de teste permanecem preservados por solicitação do usuário. Sua eventual limpeza deve ser tratada na próxima publicação autorizada, com identificação segura dos registros fictícios, recuperação e preservação dos registros reais. Nenhuma limpeza automática foi acrescentada.

## Publicação autorizada depois da revisão

Após o pedido expresso do usuário para publicar na Vercel, esta rodada foi publicada no endereço habitual:

- URL: https://portal-tcc-enfermagem-ufes.vercel.app/
- Deployment: `dpl_9b9RBaDyqVCF2US2DkV3QDt97EjK`.
- URL imutável: https://portal-tcc-enfermagem-ufes-2fu7d5pos-tcc-enfermagem.vercel.app/
- A Vercel concluiu a implantação como READY; a promoção ao domínio habitual terminou com sucesso.
- As dez verificações de integração do build passaram, incluindo os dados de amostra com a configuração real do Estúdio e a abertura dos PDFs dos quatro modelos oficiais pelo leitor PDF.js.
- O navegador carregou `/assets/index-C7G2tMTU.js` no domínio habitual e confirmou a nova aba Geral, as abas alinhadas e a apresentação dos dados. Evidência: `output/revisao-2026-10-20-rodada20/geral-publicado.jpg`.
- Os dados de teste foram preservados. Não houve limpeza, importação de demonstração, push ou merge.
- A conferência autenticada do upload de comprovante e da prévia pela interface administrativa fica disponível para o teste do usuário; não foi executada nenhuma confirmação acadêmica, assinatura pessoal ou envio de convite para produzir esta evidência.
