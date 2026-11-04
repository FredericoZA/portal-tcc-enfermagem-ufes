# Revisão local da operação e privacidade — 04/11/2026

Esta revisão consolida a PR #180 na candidata local, preservando as três assinaturas da ata e o ciclo de reservas já corrigido. Não altera produção, segredos, permissões Google, dados Supabase nem autorizações de publicação. A verificação é técnica e não certifica conformidade jurídica ou homologação pela UFES.

## Achados e correções

1. **IND-01 — Exposição pública e divergência entre ambientes (corrigido).** `server/vercel/public-indicators.ts` calculava indicadores a partir de palavras-chave e locais livres, enquanto `server/publicIndicators.ts` já os excluía. O endpoint Vercel e a antiga rota Express agora retornam 410 sem dados. `/api/admin/indicators` usa autenticação e os papéis Master/Presidência, o cálculo único protegido e `private, no-store`. O painel utiliza o cliente autenticado e limpa os resultados quando muda a identidade. Ocultar o menu sozinho não foi usado como controle de segurança.
2. **AI-01 — Interfaces antigas sem uso (corrigido).** `FileViewer.tsx`, `DropZone.tsx` e o tipo `AIAnalysisResponse` não possuíam consumidores e foram retirados. A comparação de marcadores em `UnifiedFlowSystem.tsx` é feita por regras de texto e agora é descrita dessa forma. Não foi alterada para esconder uma chamada a modelo. O antigo motor de propostas não existe; suas rotas continuam em 410 e o estado histórico permanece preservado.
3. **DOC-01 — Inspeção de cópias públicas incompleta (reforçado).** `server/publicAcademicDocuments.ts` já bloqueava e-mails, registros numéricos e anexos. Acrescentados CPF formatado, campos de identificação/contato e comparação de registros alfanuméricos conhecidos no texto e nos metadados. Os bytes assinados nunca são editados. Conteúdo em imagens e outros dados sensíveis não reconhecidos exigem revisão dos modelos; não se declara anonimização absoluta.
4. **GOV-01 — Afirmações documentais imprecisas (corrigido).** Guia de instalação e nota técnica distinguem dados operacionais, originais Drive, transporte temporário, decisões humanas e indicadores restritos. A consulta Supabase relatada pela PR #180 está identificada como evidência herdada, sem revalidação nesta etapa. O índice institucional foi acessível, mas não foi recuperada uma nova cópia autenticada do ato específico; a transcrição existente continua identificada como apoio.

## Evidências a executar na versão integrada

- Testes HTTP locais: 401 sem sessão, 403 para aluno, 200 para Master/Presidência; 410 nas rotas públicas e nos diagnósticos retirados; cache privado.
- Testes PDF com conteúdo e metadados sintéticos: manter PDF seguro intacto e recusar identificadores privados.
- Testes dos três roteiros de parecer: título cadastrado, fundamentação humana e bloqueio de instruções não preenchidas.
- Verificação de fontes/dependências, TypeScript, suíte unitária, fluxo seguro, compilação, empacotamento serverless e navegação local.

Os resultados e os limites efetivamente verificados são registrados em `.portal-data/policy-review-2026-11-04/estado.json` no workspace de trabalho, sem dados pessoais de produção. Integrações reais, contratos, retenção, direitos dos titulares e eventual enquadramento institucional permanecem fora da comprovação local.
