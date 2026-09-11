# Guia de entrega ao Codex de implantação

Versão de referência: **1.0.0-rc.10**. Leia primeiro `FLUXO_OPERACIONAL_RC9.md` e `HOMOLOGACAO_RC10.md`; os relatórios RC5/RC6/RC7/RC8 são históricos.

Este arquivo é a passagem de bastão para o agente técnico que receber o ZIP. A meta não é redesenhar o portal nem criar uma instalação multicurso. A meta é implantar esta versão para o Curso de Enfermagem, ligar as contas do proprietário e provar o fluxo completo com dados fictícios.

## Resultado esperado

Ao final, uma instalação independente deve executar:

`aluno autorizado → login por código → cadastro do TCC → e-mail de reserva ao departamento → confirmação do local → convite por DOCX/PDF e Gmail → conferência dos dados e nota pelo orientador → Ata assinada e arquivada → entrega final → Termo condicional assinado e arquivado → Declaração na Asten → PDFs assinados no Drive → e-mail final → conclusão/publicação`

O Master personaliza identidade, aparência, modelos DOCX, formulários, e-mails, variáveis e sequência operacional. Outra secretaria pode reutilizar o código em uma implantação separada, com banco, Drive e credenciais próprios; o runtime não deve virar multicurso.

## Instrução para o agente técnico

1. Descompacte o projeto e leia `README.md`, `IMPLANTACAO_PRODUCAO.md`, `docs/PRIMEIRO_ACESSO.md` e `docs/TESTES_HOMOLOGACAO.md` antes de alterar qualquer arquivo.
2. Execute `npm ci`, `npm run test:ci` e `npm run test:secure-flow`. Não avance se qualquer teste falhar.
3. Crie ou conecte um projeto Supabase exclusivo e aplique todas as migrações, na ordem dos nomes. Confirme runtime v6, RLS, bucket privado, staging, revisão otimista e outbox Asten.
4. Crie ou conecte o projeto Vercel com Node.js 22. Cadastre as variáveis de `.env.example` nos ambientes corretos. Nunca copie `.env.local` e nunca exponha segredos com prefixo `VITE_`.
5. Configure Google Drive, Docs, Gmail e Calendar em um projeto Google Cloud do proprietário. Use o callback exato da implantação e uma conta institucional controlada pelo Master.
6. Configure Asten com repositório, callback HTTPS e segredo de webhook. O token deve ser informado na tela autenticada, não gravado no código nem enviado em conversa.
7. Faça o primeiro acesso pelo bootstrap do Master, crie a estrutura do Drive e envie os quatro modelos DOCX pelo portal. A importação por link deve permanecer desativada, salvo decisão consciente de ampliar o escopo OAuth.
8. Na Oficina, informe e-mail do departamento, locais, cadastro inicial, catálogos, apresentações das variáveis, calendário útil e lembretes. Gere a amostra real de cada DOCX pelo Google e compare o rascunho com a revisão publicada. Publique somente depois de o validador aprovar formulários, modelos, e-mails, variáveis, eventos, prazos e aparência.
9. Execute o piloto completo com TCC, PDFs e destinatários sem valor jurídico. Confirme rascunho recuperado, comprovante da reserva, conteúdo do DOCX/PDF, destinatários Gmail, signatários e ordens Asten, callback, hashes, Drive privado, retentativas, conclusão e publicação.
10. Atualize os dois arquivos vivos e gere o relatório institucional filtrado. Confirme os IDs estáveis, as revisões no Drive, a metodologia e a ausência de dados pessoais. Depois execute a galeria visual nas larguras 320, 768, 1024 e 1440 px, aprove uma linha de base revisada e teste zoom de 200% e 400%, teclado e leitor de tela.

## Regras que não podem ser flexibilizadas

- Somente Master e Presidente administram o portal.
- O aluno pode criar um TCC de graduação, mas pode participar de outros processos em papéis diferentes.
- O navegador não decide permissões, destinatários, signatários, ordem de assinatura ou credenciais.
- Convite não é assinado. Ata é assinada pelo orientador. Termo só existe quando houver publicação e usa aluno(s) e orientador em paralelo. Declaração é assinada pelo Presidente.
- O processo só termina depois que todos os documentos aplicáveis retornam assinados e são arquivados no Drive.
- Falha parcial não pode liberar a etapa seguinte. Resultado ambíguo da criação de envelope não pode causar reenvio automático.
- Modelos ativos são externos, versionados e fixados por SHA-256. O ZIP não contém modelos oficiais nem credenciais.
- Supabase guarda estado e transporte temporário privado; Google Drive é o arquivo documental definitivo.
- A inteligência contínua pode propor melhorias, mas não pode alterar automaticamente formulários, modelos, e-mails, assinaturas ou etapas publicadas.
- Rascunhos, comprovantes de reserva, relatórios e arquivos intermediários são privados; o navegador nunca recebe uma URL pública permanente do Drive.
- Uma retentativa preserva as ações já concluídas e não pode repetir automaticamente um envelope Asten cujo resultado seja incerto.

## Evidências mínimas da implantação

O agente deve devolver ao proprietário, sem expor dados pessoais ou segredos:

- URL da Preview e da produção;
- commit ou hash do artefato implantado;
- resultado dos testes locais;
- versão das migrações e confirmação do runtime v6;
- confirmação de bucket privado e rotina diária de limpeza;
- IDs não sensíveis das pastas e arquivos de homologação no Drive;
- confirmação dos destinatários Gmail e dos signatários/ordens Asten do piloto;
- confirmação de callback idempotente e arquivamento do PDF assinado;
- capturas responsivas sem tokens nem dados reais;
- lista explícita de itens aprovados, reprovados e **não confirmados**.

## Critério de encerramento

“Build aprovado” não significa “produção pronta”. A implantação só pode ser liberada para TCCs reais quando todos os bloqueios de `docs/TESTES_HOMOLOGACAO.md` estiverem aprovados no ambiente do proprietário. Se faltar credencial, permissão ou escolha institucional, o agente deve parar naquele ponto, marcar **não confirmado** e pedir a ação específica necessária.
