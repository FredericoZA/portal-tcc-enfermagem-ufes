# Relatório de validação RC7

Data: 8 de setembro de 2026. Versão: `1.0.0-rc.7`.

## Escopo entregue

Cadastro operacional editável, reserva do local, marcos de assinatura, Oficina, mapeamento de variáveis, simulador, catálogos, indicadores por período, tempos por etapa, relatórios exportáveis, dois arquivos vivos e aplicação de aparência global às novas tabelas. A relação das dez propostas e seus limites está em `RODADA_RC7.md`.

## Evidências desta execução

| Verificação | Resultado |
|---|---|
| TypeScript | Aprovado, sem erros |
| Testes unitários | 74 aprovados, 0 falhas |
| Contratos de provedores | 9 aprovados; também integram os 74 testes, não são testes adicionais |
| Fluxo seguro integrado | 35 verificações aprovadas, 0 falhas |
| Acessibilidade estática | 109 arquivos verificados |
| Build Vite e servidor esbuild | Aprovado; frontend em `dist/client`, servidor em `dist/server` |
| Execução do servidor compilado | Saúde HTTP, cabeçalho de segurança e restrição administrativa aprovados |
| Frontend compilado servido por HTTP | HTML e bundle público responderam; nenhum bundle de servidor ou sourcemap em `dist/client` |
| Inicialização de produção sem Supabase | Recusada, sem fallback para persistência local |
| Verificação de navegador | Não confirmada: Chromium ausente; `test:visual` retornou 78 |
| Dependências operacionais | Não foram adicionadas nem atualizadas nesta rodada; Playwright é instalação opcional do ambiente de verificação |
| ZIP | CRC verificado, exclusões aplicadas, duas gerações comparadas byte a byte |

Os comandos foram executados com **Node.js 24.19.0** disponível neste ambiente. O alvo declarado de implantação continua **Node.js 22**; a execução dessa mesma suíte em Node 22 faz parte da homologação no destino.

## Casos novos verificados

- Conversão da data/hora no fuso institucional e recusa de data inexistente.
- Cadastro publicado com SIAPE obrigatório, locais e campo adicional exigido pelo Master.
- Uma data de origem com representações independentes por artefato.
- Negrito do marcador dividido entre trechos do Google Docs, sem formatar o texto ao redor.
- Variáveis livres não sobrescrevem identidade, título, destinatários ou autorização de publicação.
- Todos os delimitadores de e-mail respeitam a mesma proteção de destinatários e expansão não recursiva.
- Ata e Termo vigente precisam estar assinados e arquivados antes da Declaração.
- Simulação por papéis, dupla, local pendente e interrupção após falha no convite, sem efeitos externos.
- Sinônimos, vigência do catálogo, grupos pequenos e neutralização de fórmulas no CSV.
- Falha de fluxo recuperada deixa de ser evidência ativa; limiares e prioridades configuráveis.
- Migração idempotente do rascunho antigo, preservando os modelos e a publicação original.
- Esquema inicial autenticado sem textos administrativos de e-mail ou modelos.
- Estatísticas JSON, CSV e PDF restritas a administradores; simulador não modifica processos existentes.

## Limitações materiais

Nenhuma conta real foi conectada nesta rodada. Exportação do DOCX pelo Google, envio Gmail, assinaturas Asten, concorrência e persistência no Supabase remoto, cron e execução na Vercel permanecem **não confirmados**. As integrações têm implementação e testes de contrato, não homologação real.

A análise estática não comprova conformidade WCAG, legibilidade renderizada, responsividade ou comportamento com leitor de tela. A galeria fornecida precisa ser executada com um navegador instalado e suas capturas precisam ser avaliadas.

O simulador usa dados fictícios e portas sem efeitos externos: não produz uma assinatura válida, não envia e-mails e não serve como evidência de fidelidade dos modelos no Google. A liberação para uso real depende de `HOMOLOGACAO_RC7.md` e `TESTES_HOMOLOGACAO.md`.
