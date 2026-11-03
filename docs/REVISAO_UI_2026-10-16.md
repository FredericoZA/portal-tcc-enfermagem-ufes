# Revisão local de interface e modelos, 16/10/2026

## Solicitações desta rodada

| Solicitação | Resultado verificado |
|---|---|
| Modelo Excel pré-formatado | Download HTTP de um XLSX de 35.349 bytes com duas abas, cabeçalho verde, filtros, primeira linha fixa, 100 linhas formatadas e matrícula como texto. |
| Modelo Google Planilhas pré-formatado | Implementada conversão do mesmo XLSX em uma base privada no Sistema do Drive e abertura da tela de cópia. Teste da API com respostas simuladas. No local desconectado, oferece o XLSX compatível e informa como importar. |
| Modelo documental não aparece | O catálogo local tinha referências de demonstração sem DOCX. Foram enviados os quatro DOCX fictícios do piloto, com quatro variáveis em cada um. Abertura da carta-convite e do termo confirmada no navegador. |
| Laterais do editor de e-mails | Pop-up com 914 px; conteúdo de 880 px, com 17 px em cada lateral. Continua responsivo em telas menores. |
| Adicionar e-mail na barra de título | Ação transferida para o cabeçalho do pop-up. Prévia do e-mail continua abrindo. |
| Contador de etapas sálvia | Fundo RGB (140, 177, 163), equivalente a #8CB1A3, confirmado no navegador. |

A moldura adicional das variáveis também foi removida; o grupo usa uma divisão
simples dentro do painel do documento.

## Verificação

- `npm run test:ci`: aprovado. 570 testes unitários e 17 contratos de integração;
  TypeScript, segredos, acessibilidade estática, finalização, build e smoke HTTP.
- `npm run test:secure-flow`: 40 aprovados, zero falhas.
- XLSX efetivamente baixado pelo navegador inspecionado com um leitor independente
  (openpyxl). Cabeçalhos, estilos, filtros, abas e formato de texto conferidos.
- XLSX preenchido enviado pela interface; a prévia manteve `000012345`. Nenhum
  acesso de teste foi importado.
- Os quatro DOCX locais têm bytes presentes e hashes SHA-256 confirmados. A rota
  de leitura retorna 401 sem autenticação.
- Build aprovado com aviso sobre chunks grandes e compartilhamento do módulo de
  PDF entre editores. O leitor DOCX é carregado sob demanda.

Os contratos que ainda exigiam a paleta anterior, coluna de seleção de 54 px,
faixa branca oculta e ações fixas à direita foram atualizados para as decisões
visuais já aprovadas. A escala tipográfica móvel foi alinhada ao token de título.

## Limites

A prévia local de DOCX é uma conferência visual do arquivo original, com
marcadores visíveis. Não certifica paginação do PDF oficial, assinatura ou envio.
Os quatro arquivos carregados são fictícios e se identificam dessa forma.
A criação direta da planilha no Google não foi homologada com uma conta real
nesta rodada. O ambiente local permanece isolado das credenciais publicadas.
Nenhum push, deploy ou alteração de modelos na instalação publicada foi feito.

Referências de implementação:
[conversão de arquivos no Drive](https://developers.google.com/workspace/drive/api/guides/manage-uploads)
e [leitor DOCX](https://github.com/VolodymyrBaydalka/docxjs).

## Segunda rodada: 23 comentários

| Comentários | Alteração |
|---|---|
| 1, 2, 8, 19 | Cancelar, Voltar, Usar texto-padrão e Adicionar campo usam sálvia `#8CB1A3`; controles secundários compartilham o token. |
| 3, 4 | Cadastro do TCC com ícone e sem subtítulo explicativo. |
| 5, 11 | Botões nas barras de título usam a mesma família, tamanho e peso tipográfico. |
| 6 | Código e título em caixa independente acima do fluxo; removidas quatro caixas repetidas. |
| 7 | Barra de seções sálvia, botões brancos e aba selecionada com aparência de pasta. |
| 8 | Parecer-padrão considera título, autores, protocolo e resultado escolhido. Exige complementação da fundamentação e recomendações; não atribui elogios nem resultado automático. |
| 9 | Declarações com alternativa Gov.br e conferência manual no VALIDAR/ITI. Upload pendente, aprovação por hash, auditoria e recuperação de arquivamento. |
| 10 | Adicionar membro substituído por botão compacto “Adicionar”. |
| 12, 13, 14, 17 | Novo modelo, Adicionar documento, Adicionar e-mail e lixeiras usam ícones com nomes acessíveis e dicas. |
| 15 | Rótulo “HTML” no cabeçalho. |
| 16, 18 | Ver modelo fica junto da lixeira no editor do e-mail e no cabeçalho interno do formulário. |
| 20 | Margem inferior persistente no editor de formulários. |
| 21, 22 | Etapas em cartões brancos com profundidade; corpo da tabela cinza-claro `#E9EDEF`. |
| 23 | Adicionar etapa visível na barra de título; preservada a ordem de etapas do rascunho existente. |

### Evidências desta rodada

A verificação no navegador confirmou as cores calculadas, a caixa de identificação acima do fluxo, as cinco abas brancas sobre sálvia, a posição de Ver modelo junto às lixeiras, os ícones acessíveis, a margem de 17 px na base do formulário, os cartões brancos e o corpo cinza da tabela de fluxo. O botão Adicionar etapa está ligado ao manipulador existente; não criamos uma etapa no rascunho do usuário para verificá-lo.

O fluxo Gov.br foi exercitado pela interface em um servidor isolado, com declaração fictícia e CMS de teste sem validade: preparação, download, devolução, exibição do hash e aprovação desativada sem as três confirmações. Nenhum PDF foi enviado ao Gov.br ou ITI, nenhuma assinatura real foi feita e nenhuma aprovação de assinatura real foi registrada.

As capturas ficam em `output/revisao-ui-2026-10-16/`: `detalhes-caixa-e-abas.png`, `email-acoes-padronizadas.png`, `fluxo-etapas-brancas.png`, `govbr-conferencia-manual-teste.png` e `govbr-aprovacao-pendente-teste.png`. O procedimento e seus limites estão em [Assinatura Gov.br](./ASSINATURA_GOVBR_CONFERENCIA_MANUAL.md).

Validação final da segunda rodada: `npm run test:ci` aprovado com 576 testes
unitários e 17 contratos de integração, além de TypeScript, segredos,
acessibilidade estática, finalização, build e smoke HTTP. `npm run test:secure-flow`
aprovado com 40 verificações. O build mantém os avisos de chunks grandes já
registrados. A suíte HTTP Gov.br testa somente armazenamento local isolado;
o novo caminho em Drive/Supabase e um PDF real Gov.br ainda precisam de piloto.

## Terceira rodada: oito comentários

- Presidência: Gov.br também na barra de título, ao lado da Asten. A seleção admite declarações disponíveis para qualquer um dos dois métodos. Gov.br abre diretamente uma declaração selecionada ou uma lista quando há várias; o servidor mantém os pré-requisitos e bloqueios entre provedores.
- Fluxos: pop-up ampliado para até 1.600 px, respeitando as margens da tela. No viewport de 1.791 px, sequência e tabela ficaram sem rolagem horizontal.
- Adicionar etapa saiu da barra de título e passou a ser um cartão branco com “+” após a última etapa, ligado ao manipulador existente de criação e seleção da nova etapa.
- Faixa branca de 15 px entre os dados da etapa e a tabela de ações.
- Formulários, e-mails e documentos usam o mesmo par de botões: olho branco, sem texto, e lixeira vermelha no cabeçalho do elemento. Cada botão mede 30 × 30 px e mantém nome acessível e dica.
- Adicionar membro passou a ser um botão branco apenas com “+”, também de 30 × 30 px.

Verificação em navegador: prévias dos três editores abertas; seleção de duas declarações pelo botão Gov.br abriu a lista e a escolha de uma abriu o fluxo manual. Seleção única abriu diretamente o mesmo fluxo. Nenhum documento foi preparado ou enviado durante esses testes e a seleção temporária foi limpa. A ordem das etapas do rascunho foi preservada.

Validação: `npm run test:ci` aprovado com 577 testes unitários, 17 contratos,
TypeScript, segredos, acessibilidade estática, finalização, build e smoke HTTP.
Capturas em `output/revisao-8-comentarios/`. Alterações somente locais, sem push ou deploy.
