# Portal TCC: padrão visual

## Contexto

Interface de trabalho acadêmico, usada para preencher formulários, conferir planilhas e assinar documentos. A hierarquia deve permanecer legível em telas largas e estreitas, com identidade institucional verde e fundos neutros claros.

## Superfícies

A ordem solicitada pelo responsável é: branco gelo no fundo da página e do pop-up; cinza claro nos painéis maiores; cinza médio nos grupos internos; branco nas linhas e subdivisões de conteúdo. Campos, linhas de planilha e controles usam branco. Os valores atuais estão centralizados em src/styles/portal-tokens.css:

| Papel | Token | Valor atual |
| --- | --- | --- |
| Página e pop-up | --portal-surface-page | #f6f7f8 |
| Painel maior | --portal-surface-panel | #e9edef |
| Grupo interno | --portal-surface-card | #d8dfe3 |
| Subdivisão de conteúdo | --portal-surface-nested | branco (alias de --portal-surface-inner) |
| Campo e planilha | --portal-surface-inner | #ffffff |
| Verde institucional | --portal-brand-header | #005830 |
| Ação e foco | --portal-brand-action | #337959 |

## Componentes e disposição

- Cabeçalhos de seção verdes, títulos legíveis e ícones dentro dos respectivos controles.
- Planilhas administrativas preenchem o espaço útil do pop-up, com rolagem na própria área de tabela.
- Integrações em duas colunas quando houver largura: Asten à esquerda; Google, Supabase e Vercel empilhados à direita. Em telas estreitas, uma coluna com rolagem acessível.
- O fluxo do TCC preserva a faixa clara e os estados verdes já aprovados; o indicador da etapa usa verde forte.
- No tutorial de nove passos, o encerramento ocupa o espaço ao lado do nono passo em telas largas e segue a ordem natural em telas estreitas.
- Sem alterar o conteúdo ou as variáveis dos modelos para corrigir aparência.
- Instruções e observações usam a classe compartilhada portal-instruction, com amarelo suave; dados permanecem em superfícies neutras.
- Botões de ação usam cápsulas. Cartões de etapas em Fluxos e atalhos de mapas usam retângulos compactos com raio de 8 px.
- Entrega final: somente o botão centralizado, verde musgo antes de enviar e sálvia após o registro, sem caixa externa nem texto redundante.

## Validação

Conferir as telas no navegador após a publicação de homologação. Os contratos de CSS e acessibilidade complementam a inspeção visual; não a substituem.
