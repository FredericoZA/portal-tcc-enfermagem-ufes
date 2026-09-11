# Relatório de validação RC8

Data: 9 de setembro de 2026. Versão: `1.0.0-rc.8`.

## Escopo entregue

As dez melhorias de `RODADA_RC8.md` foram implementadas com foco no fluxo configurável: rascunho do cadastro, confirmação documentada da reserva, amostra Google dos modelos, comparação antes de publicar, retomada centralizada, regressão visual governada, prazos úteis, análise de PDF, alertas cadastrais e relatório institucional aprofundado. A documentação vigente do processo está em `FLUXO_OPERACIONAL_RC8.md`.

## Evidências desta execução

| Verificação | Resultado |
|---|---|
| TypeScript | Aprovado, sem erros |
| Testes unitários | 84 aprovados, 0 falhas |
| Contratos de provedores | 9 aprovados; também integram os 84 testes, não são adicionais |
| Fluxo seguro integrado | 38 verificações aprovadas, 0 falhas |
| Acessibilidade estática | 115 arquivos verificados |
| Build Vite e servidor esbuild | Aprovado; frontend em `dist/client`, servidor em `dist/server` |
| Execução do servidor compilado | Saúde HTTP, SPA, cabeçalhos de segurança e separação cliente/servidor aprovados pelo `test:http` |
| Inicialização de produção sem Supabase | Recusada de forma segura, sem fallback local |
| Dependências de produção | `npm audit --omit=dev --audit-level=high`: 0 vulnerabilidades conhecidas |
| Verificação de navegador | Não confirmada: Chromium ausente; `test:visual` retornou 78 e não gerou capturas |
| Comparação visual | Implementada, mas corretamente recusada sem capturas e sem linha de base aprovada |
| Varredura do pacote-fonte | Nenhum `.env` real, chave privada, segredo Google ou token Supabase encontrado; um valor propositalmente falso existe apenas no teste de rejeição de chave legada |

Os comandos foram executados com Node.js 24.19.0 e npm 11.9.0 disponíveis neste ambiente. O projeto declara Node.js 22.x para a Vercel; a tentativa de obter um executável Node 22 adicional não concluiu neste ambiente. A execução da mesma suíte em Node 22 continua parte da homologação da implantação.

## Casos RC8 verificados

- Rascunho pertence ao aluno autenticado, força seu e-mail canônico, expira e rejeita conflito de revisão.
- Campos adicionais do formulário permanecem disponíveis para documentos e etapas futuras depois do arquivamento.
- Confirmação de local exige declaração explícita; comprovante inválido é recusado e o convite continua bloqueado.
- Amostra real falha de forma segura sem Google, recebe marca d'água e aponta marcador pendente, página vazia e limite de páginas.
- Modelo ativo permanece fixado por revisão e SHA-256; alteração direta no Drive bloqueia a geração.
- Termo é omitido sem publicação e usa aluno(s) e orientador em paralelo quando aplicável.
- Asten só aceita o PDF final quando signatários e ordens devolvidos coincidem exatamente com o esperado.
- Retomada preserva ações concluídas, interrompe depois da primeira falha e não recria envelope de resultado incerto.
- Prazos excluem fins de semana e feriados; lembrete usa destinatário canônico, escapa HTML e respeita limites.
- Central mostra somente a versão documental vigente e suporta falha de configuração sem derrubar o painel.
- Relatório institucional produz PDF vetorial com metodologia e sem nomes, e-mails, matrículas, títulos ou resumos.
- Comparação visual calcula divergência sem aprovar automaticamente uma referência.
- Servidor recusa alteração genérica de identidade, avaliação, publicação e vínculos documentais protegidos.

## Limitações materiais

Nenhuma credencial institucional foi usada. Conversão e fidelidade reais no Google Docs, entrega Gmail, assinatura Asten, callback público, arquivamento real no Drive, concorrência/persistência no Supabase remoto, Cron e limites da Vercel permanecem **não confirmados**. A implementação e os testes de contrato não substituem o piloto descrito em `HOMOLOGACAO_RC8.md`.

A checagem estática não prova responsividade, contraste final das paletas, teclado, zoom ou leitor de tela. Como o Chromium não está disponível, nenhuma captura RC8 nem linha de base visual foi aprovada. A comparação por pixel só deve ser ativada depois de uma pessoa conferir e identificar explicitamente a primeira referência.

O ZIP de release exclui dependências instaladas, build, estado local, logs, `.env` real e modelos DOCX. Sua integridade e reprodutibilidade devem ser verificadas após a geração; o SHA-256 é informado junto ao arquivo distribuído, para não criar autorreferência dentro do próprio pacote.
