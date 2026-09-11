> Histórico RC7. Use o roteiro vigente [HOMOLOGACAO_RC8.md](./HOMOLOGACAO_RC8.md).

# Homologação RC7

Os testes locais usam dados fictícios e portas de integração controladas. Simulador aprovado, contratos aprovados e build aprovado não comprovam o comportamento de Google, Gmail, Asten, Supabase ou Vercel reais.

## Preparação

Leia `ENTREGA_AO_CODEX.md`. Prepare uma instalação de homologação com as contas do proprietário, destinatários de teste, quatro modelos DOCX sem valor jurídico e PDFs fictícios. Informe segredos somente no painel autenticado ou no ambiente da implantação. Não coloque tokens em evidências, capturas, relatórios ou no repositório GitHub.

## Roteiro de aceitação

| Passo | Verificação | Evidência esperada | Estado nesta entrega |
|---|---|---|---|
| 1 | Instalação Supabase v6, RLS, staging privado, Vercel, bootstrap e OTP | Sessão válida, OTP reutilizado recusado, commit durável antes do sucesso HTTP | Não confirmado em contas reais |
| 2 | Master altera rótulo e inclui pergunta obrigatória no cadastro | Aluno recebe a revisão publicada; campo é validado no navegador e servidor | Contrato local aprovado; piloto pendente |
| 3 | Cadastro individual e em dupla, SIAPE, banca e local alternativo | Dados integrais arquivados no formulário e usados nas etapas posteriores | Piloto pendente |
| 4 | Pedido de reserva | Gmail sai da conta do Master para o departamento; local preferido e alternativa corretos | Não confirmado |
| 5 | Local pendente / confirmação recebida | Sem convite antes da confirmação; após registro, o modelo gera PDF e anexo real | Bloqueio local aprovado; Google/Gmail pendentes |
| 6 | Variáveis e layout | Data, hora, extenso, caixa e negrito corretos; nenhum marcador pendente no PDF | Regras locais aprovadas; fidelidade Google pendente |
| 7 | Ata | Orientador avalia e assina; entrega final bloqueada até PDF assinado no Drive | Bloqueio local aprovado; Asten pendente |
| 8 | Entrega final sem publicação | PDF completo privado; nenhum Termo; Declaração só após Ata arquivada | Regras locais aprovadas; piloto pendente |
| 9 | Publicar completo, expandido e ambos; dupla | Termo contém escolhas corretas, autores e orientador em prioridade 1 | Contrato local aprovado; Asten pendente |
| 10 | Presidente | Declaração apenas depois do Termo aplicável; assinatura do Presidente | Regra local aprovada; Asten pendente |
| 11 | Falha temporária, timeout e callback duplicado | Sem próximo passo indevido, assinatura duplicada ou arquivo de outro TCC | Testes locais aprovados; concorrência remota pendente |
| 12 | Conclusão | Todos os PDFs aplicáveis no Drive; e-mail final só então; publicação respeita escolhas | Não confirmado integralmente |
| 13 | Dois arquivos vivos | Atualização manual e cron; mesmo ID, nova versão, arquivos privados | Cálculo/contrato local aprovados; Drive/cron pendentes |
| 14 | Temas e tempos | Sinônimos consolidados, categorias pequenas agrupadas, ausências explícitas, CSV/PDF coerentes | Cálculo/exportações locais aprovados |
| 15 | Interface | Capturas em 320/768/1024/1440 px; teclado, zoom 200%/400%, leitor de tela, alto contraste | Não confirmado |

Repita os passos 5–12 em todas as combinações de publicação, sem mandar mensagens a pessoas que não participem do piloto. A confirmação do departamento é registrada pelo aluno com base na comunicação recebida; o portal não lê a caixa postal do departamento para decidir sozinho.

## Galeria de regressão

Em ambiente de verificação descartável com Node 22:

```bash
npm ci
npm install --no-save --package-lock=false playwright@1.62.1
npx playwright install chromium
npm run test:visual
```

O script cria um servidor local com dados de demonstração, usa autenticação fictícia somente nesse ambiente, captura início e Oficina em quatro larguras e alto contraste e produz `../portal-visual-rc7/index.html` e `resultado.json`. Não publica configurações nem envia documentos ou e-mails. Não execute com credenciais reais no ambiente de verificação.

Código de saída 78 significa navegador ausente: **não confirmado**, nunca aprovado. Código 1 indica falha. Código 0 significa capturas geradas sem os erros automatizados observados; uma pessoa ainda precisa avaliar aparência, zoom real e leitura assistiva. Nesta entrega o Chromium está ausente, e não há capturas renderizadas aprovadas.

## Registrar a decisão

Para cada passo anote data, revisão do Estúdio, hash do ZIP/commit, código do TCC fictício, resultado e referência privada à evidência. Classifique como aprovado, reprovado ou não confirmado. Limpe os dados do piloto segundo a política da instalação. Só libere uso acadêmico real após resolver os bloqueios de `TESTES_HOMOLOGACAO.md` e deste roteiro.
