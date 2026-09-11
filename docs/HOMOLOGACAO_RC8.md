# Homologação RC8

Os testes locais desta entrega usam dados fictícios e integrações controladas. Eles comprovam contratos e bloqueios do código, mas não comprovam conversão real no Google, entrega Gmail, assinatura Asten, persistência Supabase, execução Vercel ou aparência renderizada. Esses itens continuam **não confirmados** até o piloto na instalação do proprietário.

## Preparação segura

1. Implante uma Preview com Node.js 22, Supabase de homologação e bucket privado.
2. Use conta Google e repositório Asten exclusivos do piloto.
3. Cadastre quatro DOCX sem valor jurídico, destinatários controlados e PDFs fictícios.
4. Publique um Estúdio de homologação com e-mail do departamento de teste, dois locais, formulários, mapeamentos, eventos e pelo menos uma regra de prazo.
5. Não grave tokens, OTPs, cookies, conteúdo Base64 ou dados reais em capturas, logs, evidências ou conversas.

## Roteiro de aceitação do fluxo

| Passo | Prova | Resultado esperado nesta entrega |
|---:|---|---|
| 1 | Acesso autorizado e OTP | Código de uso único, sessão privada, revogação efetiva na próxima requisição |
| 2 | Rascunho do aluno | Recupera campos após sair; conflito de versão não sobrescreve silenciosamente; nova revisão do formulário exige conferência |
| 3 | Cadastro individual e em dupla | Campos, data/hora, banca, SIAPE e perguntas extras chegam ao processo e ao PDF arquivado |
| 4 | Pedido de reserva | Gmail sai da conta conectada para o endereço publicado do departamento, com local preferido e alternativa |
| 5 | Espera e comprovante | Convite bloqueado; confirmação explícita registra ator/data; PDF opcional fica privado e vinculado ao TCC correto |
| 6 | Amostra dos quatro modelos | PDF real recebe marca d'água, usa revisão/hash corretos e aponta marcador pendente, página vazia, excesso de páginas e reserva inferior |
| 7 | Convite | DOCX do Master gera PDF no Drive e o e-mail publicado leva o anexo correto; nenhum envelope Asten |
| 8 | Avaliação e Ata | Somente orientador vinculado avalia depois do início da defesa; Ata usa o parecer e só o orientador assina |
| 9 | Entrega final | Bloqueada até Ata assinada no Drive; cinco palavras-chave, resumo de 3–5 parágrafos e trabalho PDF obrigatórios |
| 10 | Quatro cenários de publicação | Sem publicação: sem Termo; completo, expandido e ambos: Termo descreve a escolha e usa autores + orientador em paralelo |
| 11 | Declaração e conclusão | Presidente assina somente depois do Termo aplicável; e-mail final somente depois de todos os PDFs aplicáveis arquivados |
| 12 | Falhas e concorrência | Timeout, callback duplicado, Drive temporariamente indisponível e duas instâncias não duplicam envelope nem avançam indevidamente |
| 13 | Prazos e lembretes | Feriado é descontado, máximo é respeitado, modelo não possui anexo, falha aparece na Central e cron é autenticado |
| 14 | Estatística | Período e comparação corretos; temas/áreas/tipos/finalidades consistentes; relatório sem nomes, matrículas, títulos e resumos |
| 15 | Aparência | Capturas 320/768/1024/1440, alto contraste, linha de base aprovada por pessoa, diferença por pixel, zoom, teclado e leitor de tela |

## Conferência da pasta do Drive

Para um protocolo fictício, verifique `Documentos/Convite`, `Documentos/Ata`, `Documentos/Termo de autorização` e `Documentos/Declaração`, sempre com a subpasta do protocolo. Compare os arquivos `Gerados` e `Assinados`, nomes, versões, IDs e SHA-256. O convite só deve existir em `Gerados`. O comprovante da reserva deve ficar em `02_PROCESSOS/{ANO}/{PROTOCOLO}/09_COMPROVANTE_RESERVA`. Tente abrir os arquivos com uma conta não autorizada e confirme a negativa.

## Conferência Asten

Antes de clicar, confira documento, protocolo e signatários. Na Ata deve existir apenas o orientador; no Termo, todos os autores e o orientador na prioridade 1; na Declaração, apenas o Presidente. Depois da assinatura, repita o callback e confirme que ele é reconhecido como duplicado. Compare o PDF assinado, a lista devolvida pelo provedor e o arquivo arquivado no Drive. Resultado incerto exige reconciliação, nunca um segundo clique automático.

## Regressão visual

Em ambiente descartável e sem credenciais reais:

```bash
npm ci
npm install --no-save --package-lock=false playwright@1.62.1
npx playwright install chromium
npm run test:visual
```

Depois da avaliação humana das capturas, crie explicitamente a linha de base identificando o revisor conforme a ajuda de `npm run test:visual:compare`. Em versões futuras, execute novamente a comparação. Código 78 significa navegador ausente e deve ser registrado como **não confirmado**; código 0 na captura ou na comparação não equivale a conformidade WCAG.

## Critério de liberação

Registre data, revisão do Estúdio, hash do ZIP/commit, protocolo fictício, evidência privada e resultado de cada passo. Só libere dados acadêmicos reais depois que `docs/TESTES_HOMOLOGACAO.md` e todos os passos acima estiverem aprovados no ambiente do proprietário. Falta de credencial ou permissão deve ser marcada como **não confirmado**, nunca transformada em aprovação presumida.

