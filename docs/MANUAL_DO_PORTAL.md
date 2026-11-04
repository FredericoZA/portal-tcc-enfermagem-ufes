# Manual público do Portal de TCC

O atalho **Manual** fica no grupo inferior do menu lateral, junto de **Declaração de
comparecimento** e **Sugestões**. Abre diretamente `/manual/manual-portal-tcc.pdf`,
em nova aba, sem solicitar login. Não contém informações reais dos participantes.

O guia de 04/11/2026 tem 17 páginas para alunos, orientadores e examinadores. Ensina
acesso por código de e-mail, cadastro, reserva, conceito, conferência documental,
entrega obrigatória do PDF do TCC e publicação opcional por arquivo. O tutorial de
assinatura usa apenas o Asten. A ata exige orientador e os dois examinadores; o
termo aplicável exige todos os autores e o orientador; a declaração da banca exige
a Presidência da Comissão.

O modelo em branco de comparecimento continua separado da declaração de
participação na banca. A integração das três assinaturas não reenvia solicitações
existentes. Solicitações antigas com destinatários diferentes são bloqueadas para
revisão e cancelamento antes da emissão de uma nova versão.

## Atualizar o guia

1. Conferir os controles e as regras no código atual, principalmente
   `server/workflow/signaturePolicy.ts`, `AdvisorEvaluationPanel.tsx`,
   `ProcessoDetailPage.tsx` e o acesso em `HomePage.tsx`.
2. Compilar e executar `node --import tsx scripts/capture-guide-images.ts`.
   O script usa banco temporário, participantes fictícios e bloqueio de chamadas
   externas. O exemplo do código de acesso é interceptado no navegador; nenhum
   e-mail é enviado. Capturas de documentos concluídos também são exemplos.
3. Executar `python3 scripts/manual/build_manual.py` com ReportLab e pypdf.
   As fontes Arial são lidas da pasta de fontes do macOS; em outro ambiente,
   configurar `PORTAL_MANUAL_FONT_DIR`. A geração não faz parte do build Vercel.
4. Renderizar todas as páginas com `pdftoppm` e conferir legibilidade, limites,
   instruções, links e conteúdo antes de distribuir o PDF.
5. Executar os testes do manual e das assinaturas e verificar no navegador que os
   três atalhos continuam funcionando. Um teste local não comprova entrega real
   de e-mail nem assinatura real no Asten.

O gerador escreve a cópia para entrega em `output/pdf/Manual_Portal_TCC_UFES.pdf`
e atualiza o arquivo público. O PDF público é um recurso estático, servido sem
consulta ao Supabase ou ao Drive. Dados e documentos reais do processo continuam
seguindo as permissões existentes do Portal.
