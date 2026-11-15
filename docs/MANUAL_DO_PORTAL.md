# Manual público do Portal de TCC

O botão **Manual em PDF** fica fixado no cabeçalho de **Como usar**, disponível nos quatro perfis: Aluno, Orientador, Examinador e Visitante. Abre diretamente `/manual/manual-portal-tcc.pdf`, em nova aba, sem solicitar login. Não contém informações reais dos participantes.

O guia revisado em 15/11/2026 tem 21 páginas para alunos, orientadores e examinadores. Ensina
acesso por código de e-mail, cadastro, reserva, conceito, conferência documental,
entrega obrigatória do PDF do TCC e publicação opcional por arquivo. O tutorial de
assinatura apresenta o envio automático pelo ASTEN e a alternativa Gov.br.
A ata exige orientador, dois examinadores, todos os autores e o coorientador
presente na sessão, até seis signatários; o
termo aplicável exige todos os autores e o orientador; a declaração da banca exige
a Presidência da Comissão.

O modelo em branco de comparecimento continua separado da declaração de
participação na banca. O processamento dos três tipos de documentos assináveis
(ata, termo e declaração) não reenvia solicitações
existentes. Solicitações antigas com destinatários diferentes são bloqueadas para
revisão e cancelamento antes da emissão de uma nova versão.

As ilustrações foram conferidas novamente em08/11/2026. O manifesto em
`public/manual/capture-manifest.json` identifica, por arquivo, as recapturas feitas
com os componentes React atuais e participantes fictícios. Essa conferência
visual não executa reservas, entregas, e-mails ou assinaturas reais.

## Correção opcional antes da ata

Em **Meus TCCs → TCC → Conceito e Ata**, o orientador vinculado ao trabalho pode usar **Verificar dados do processo** quando a etapa de registro da ata estiver liberada, somente se houver dados preenchidos incorretamente no cadastro. Se estiver correto, pode prosseguir sem abrir a conferência.

As abas **Trabalho**, **Autores**, **Orientação**, **Examinadores** e **Data e local** permitem corrigir as informações correspondentes. Apenas o e-mail do orientador não pode ser alterado. A data pode ser passada ou futura, respeitando a verificação de conflitos do calendário.

Nomes completos, título, instituições e nome ou endereço do local devem ser conferidos: a grafia salva será usada na ata e nos demais termos. Após confirmar a conferência, use **Salvar dados e voltar à ata** e confira a prévia antes do registro. **Corrigir ata** ajusta o texto da prévia e não substitui a correção cadastral.

A página 21 do PDF apresenta o passo a passo; as páginas de preparação e registro da ata apontam para ela. As ilustrações anteriores conservam suas datas de captura; a revisão textual não equivale a uma recaptura integral das telas.

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
5. Executar os testes do manual e das assinaturas e verificar no navegador que o
   acesso ao PDF e os quatro perfis continuam funcionando. Um teste local não comprova entrega real
   de e-mail nem assinatura real no Asten.

O gerador escreve a cópia para entrega em `output/pdf/Manual_Portal_TCC_UFES.pdf`
e atualiza o arquivo público. O PDF público é um recurso estático, servido sem
consulta ao Supabase ou ao Drive. Dados e documentos reais do processo continuam
seguindo as permissões existentes do Portal.
