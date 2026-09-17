# Portal TCC — critérios de aceite da finalização

Este documento registra as travas objetivas usadas antes da promoção para `main` e do único deployment de produção.

## Escopo funcional

- Padronização visual global, divisores, filtros e barras de ferramentas.
- Persistência de sessão/F5 e rascunhos de cadastro e avaliação.
- Meus TCCs, calendário/lista de defesas e Área do Presidente.
- Personalização direta, sem popup intermediário e sem opções legadas.
- Sincronização da comissão e integrações Asten, Google Drive, Supabase e Vercel.
- Autorização de acesso individual e em lote com matrícula opcional, qualidade única administrativa e exclusão segura.
- Catálogo extensível de modelos documentais, versionamento, integridade e exclusão bloqueada quando houver dependência ativa.
- Estúdio de documentos, e-mails, formulários, workflow drag-and-drop e autosave.
- Governança de variáveis: descoberta, usos, formatação, renomeação, exclusão segura, sugestões de semelhantes e prévia de impacto antes da mescla.
- QA com processos fictícios e personas distintas apenas em ambiente de desenvolvimento/homologação.

## Travas técnicas para produção

A promoção só pode ocorrer quando estiverem aprovados, no mesmo candidato final:

1. `npm audit --omit=dev --audit-level=high`.
2. TypeScript (`tsc --noEmit`).
3. Testes unitários e contratos de provedores.
4. Verificação estática de acessibilidade.
5. Contrato de finalização do backlog.
6. Build e smoke HTTP.
7. Importação do servidor em runtime de produção.
8. Auditoria `test:secure-flow`.
9. Contrato de modelo institucional.
10. Homologação visual responsiva com dados fictícios, incluindo 320, 768, 1024 e 1440 px, perfis distintos e verificação de overflow.
11. Revisão do diff contra `main` e confirmação de que não há automações/patches temporários.
12. Smoke test pós-deploy em produção.

O deployment de produção é deliberadamente único e só ocorre após essas travas.
