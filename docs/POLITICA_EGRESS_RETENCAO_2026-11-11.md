# Política de Egress e retenção — Portal TCC (11/11/2026)

## Fonte canônica
- O Supabase mantém os estados operacionais e provas de auditoria necessárias.
- O Google Drive institucional é fonte dos arquivos definitivos. PDFs, DOCX e imagens permanentes não devem ser copiados ao snapshot do runtime.
- O repositório histórico de TCCs **não é limitado** a 20 trabalhos nem é excluído após conclusão.

## Leituras
1. GET simples: projeção `portal_read_runtime_lean_v1`, sem auditoria e sem acervo legado; a projeção está disponível só ao servidor.
2. GET que precisa do acervo histórico: `portal_read_runtime_lite_v1`, sem auditoria, preservando registros legados.
3. Auditoria, operações com efeitos, commits CAS, atos documentais e restauradores: leitura completa/commit transacional com revisão confirmada.
4. Nunca substituir no estado global coleções omitidas por projeções parciais. Nenhum cache substitui uma revisão válida do Supabase.

## Retenção e expurgo automático
- Rascunho de cadastro: o fluxo de criação elimina o rascunho; o mecanismo existente expira rascunhos antigos.
- Rascunho de avaliação: eliminado na conclusão da avaliação; a manutenção diária remove resíduos **somente** após status CONCLUIDO, avaliação concluída, dados finais entregues e ata comprovadamente arquivada.
- Logs de auditoria com prova de ato acadêmico, autorização, assinatura, administração, documentos e defesa: preservar até que haja prazo de guarda institucional aprovado; não adotar janela arbitrária de 20 TCCs.
- Registros temporários do transporte privado: manter limpeza de uploads/downloads expirados, já implementada na rotina diária.
- Históricos de configurações: impedir a segunda cópia integral do estado futuro. Para os antigos, usar somente o script de manutenção com comparação exata com `portal_audit_events`, backup no mesmo commit, e leitura privada para restauração.

## Validação e recuperação
- O procedimento de compactação histórica não roda automaticamente em novas instalações e exige suporte de leitura publicado antes.
- Não truncar ou eliminar dados do histórico normalizado, backups documentais, catálogo legado, assinaturas e referências do Drive.
- Registrar revisão de origem/destino, número de eventos elegíveis, bytes reais de Egress antes/depois e ausência de falhas 402.
- Uma diminuição do tamanho de um payload não garante consumo mensal menor que 5 GB: revisar volume de solicitações, inclusive inicializações de instâncias e métodos mutáveis.
