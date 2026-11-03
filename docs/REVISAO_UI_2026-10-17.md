# Revisão local de 17/10/2026

## Oito comentários

1. **Asten em lote:** o botão da barra abre a revisão dos TCCs selecionados, inclusive quando existem pendências. A rota administrativa de conferência apenas lê o estado e usa a política canônica de assinatura. A confirmação encaminha somente as declarações prontas pelo motor de lote existente. Integração indisponível, Ata/Termo pendentes, dados finais incompletos, conflito Gov.br ou despacho incerto impedem o envio e ficam explícitos na revisão.
2. **Ações da linha:** rótulos Asten e Gov.br, com os mesmos ícones de escudo e documento assinado usados na barra.
3. **Atualização:** removido o botão manual da Presidência; mantida a observação automática existente das assinaturas.
4. **Envio de lista:** Adicionar arquivo branco.
5. **Modelos:** rótulo normal Modelos seguido dos botões Excel e Google Planilha. Os arquivos e a formatação não foram alterados.
6. **Substituição documental:** o ícone saiu da barra principal e fica entre olho e lixeira no cabeçalho do documento. Abre diretamente o seletor DOCX e usa o mesmo upload/versionamento existente.
7. **Distribuição das etapas:** cartões flexíveis ocupam toda a largura de cada linha. Quando há muitas etapas, reorganizam-se em novas linhas, mantendo o cartão “+” no fim. O corpo do pop-up admite rolagem vertical para manter os dados da etapa acessíveis.

## Evidência e limites

- A seleção de 37 TCCs abriu a revisão Asten. Nesses dados locais, zero declarações estavam prontas: havia Ata/Termo ou dados finais pendentes, além da integração Asten desconectada. Nenhum documento foi encaminhado ao provedor.
- Botões de linha identificados como Asten e Gov.br; botão Atualizar declarações ausente.
- Botão Adicionar arquivo medido como RGB 255, 255, 255. Rótulos Modelos, Excel e Google Planilha confirmados no navegador.
- Controle Substituir documento confirmado entre Ver modelo demonstrativo e Excluir, fora do cabeçalho principal. O seletor de arquivo foi aberto sem enviar um DOCX ou substituir o modelo existente.
- O fluxo operacional de sete etapas preencheu o espaço até a borda direita. Em uma página isolada com a mesma marcação e CSS, duas etapas mais o “+” ocuparam uma linha; vinte etapas mais o “+” ocuparam três linhas. Em ambos os casos, `scrollWidth === clientWidth` e o último cartão terminou na borda direita da linha. O rascunho operacional não foi transformado em 2 ou 20 etapas para esse teste.
- Capturas em `output/revisao-2026-10-17/`. A página `dimensionamento.html` é uma conferência visual estática, sem ações de edição do Portal.

O trabalho permanece local, sem push ou deploy. Os testes com provedores simulados não homologam um envio real em lote na Asten.

## Validação

`npm run test:ci` aprovado: TypeScript, 579 testes unitários, 17 contratos de
integração, segredos, acessibilidade estática, contrato de finalização, build e
smoke HTTP. `npm run test:secure-flow`: 40 verificações aprovadas. A conferência
em lote também foi testada por HTTP em servidor isolado, incluindo autenticação,
permissões administrativas, lote inválido, processo pronto e conflito com envio
Asten existente. O teste é somente leitura até a confirmação explícita do envio.

## Detalhes do TCC, revisão de ficha e navegação

- Removidos o subtítulo institucional do modal e o texto de acervo no cabeçalho do repositório. O botão de auditoria exibe “Histórico”.
- Removida a aba Formulários dos detalhes. As quatro abas restantes dividem a largura e quebram linha quando necessário.
- Barra de abas cinza médio, botões sálvia, área de conteúdo cinza claro, seções cinza médio com cabeçalhos cinza mais escuro.
- Leitura da ficha compactada em campos de identificação e participantes; preservados os controles de visibilidade e formulários de edição. A banca usa tabela com cabeçalho verde e células cinza claro.
- Preferências de publicação podem ser marcadas antes da Ata e recebem fundo verde quando selecionadas. São escolhas em memória até o salvamento. Uploads e salvamento continuam exigindo a Ata arquivada; o resumo expandido exige arquivo anexado. Nenhum processo foi salvo ou publicado durante a conferência visual.
- Conferidos no navegador: ficha, edição/cancelamento da ficha e banca, abertura do Histórico, seleção e desmarcação da publicação. Capturas em `output/revisao-2026-10-17/`.
