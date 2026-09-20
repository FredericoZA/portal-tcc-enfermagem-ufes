## Objetivo

Descreva o problema, a causa e a solução proposta.

## Validação

- [ ] Rodei `npm run test:secrets`.
- [ ] Rodei `npm run test:ci`.
- [ ] Rodei `npm run test:secure-flow` quando a alteração toca autenticação, dados, integrações, documentos ou permissões.
- [ ] Não adicionei credenciais, tokens, chaves, `.env`, arquivos de service account, documentos reais ou dados pessoais.
- [ ] Não coloquei segredos em screenshots, logs, comentários, exemplos, fixtures ou mensagens de erro.
- [ ] Novas variáveis sensíveis permanecem exclusivas do backend e não usam prefixo `VITE_`.
- [ ] Alterações em integrações externas mantêm credenciais fora do Git e do navegador.

## Segurança / LGPD

Explique qualquer impacto em autenticação, autorização, dados pessoais, arquivos privados, integrações ou auditoria. Se não houver impacto, registre `sem impacto identificado`.

## Evidências

Informe testes executados e, se necessário, anexe capturas sem dados pessoais ou segredos.
