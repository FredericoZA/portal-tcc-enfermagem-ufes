# Estabilização estrutural do Portal TCC

Enquanto esta etapa estiver aberta, não devem ser introduzidas novas variações visuais por tela. O objetivo é reduzir fontes concorrentes e tornar a execução reproduzível.

## Fonte de verdade

1. Código: branch `main`.
2. Aparência estrutural: `src/styles/portal-tokens.css` + folhas canônicas importadas por `src/index.css`.
3. Pop-ups: `PortalModalShell` e componentes explicitamente compatíveis com o mesmo contrato.
4. Produção: só é considerada atual quando o commit retornado por `/api/health` coincide com o commit que foi aprovado no `main`.

## Modos locais

- `npm run dev`: desenvolvimento rápido com Vite/HMR e dados locais.
- `npm run dev:compiled`: compila primeiro e serve o mesmo artefato de frontend utilizado na produção, mantendo backend local de desenvolvimento.
- `npm run parity:check`: compara o HEAD local com o commit que está respondendo no domínio de produção.

Nunca usar uma comparação visual local versus Vercel sem antes executar `npm run parity:check`.

## Regra de estabilização

Antes de voltar a alterações de tela:
- eliminar implementações paralelas de modal;
- manter uma única hierarquia de superfícies;
- remover estilos históricos que concorram com as folhas canônicas;
- consolidar componentes sem alterar regra de negócio;
- executar CI, QA visual e teste do bundle compilado;
- somente então publicar e confirmar o commit servido pela produção.
