# Relatório de validação — 1.0.0-rc.5

Data: 8 de setembro de 2026

## Resultado local reproduzível

| Verificação | Resultado |
|---|---|
| TypeScript (`npm run lint`) | Aprovado |
| Suíte Node (unitários e contratos) | 57/57 testes distintos aprovados |
| Contratos dos provedores | 9/9 aprovados, incluídos na suíte acima |
| Acessibilidade estática | 100 arquivos verificados |
| Build Vite e servidor | Aprovado |
| Fluxo seguro ponta a ponta | 32/32 aprovados |
| Auditoria de dependências sem rede (`npm audit --offline --omit=dev`) | 0 vulnerabilidades conhecidas no cache local |
| Smoke test HTTP do build | SPA, `/api/health` e cabeçalhos de segurança aprovados |
| Integridade e conteúdo mínimo do ZIP | Verificados pelo empacotador |

O fluxo seguro cobre administração exclusiva de Master e Presidente, autorização automática dos participantes, limite de um TCC por autor, OTP de uso único, isolamento por processo, publicação condicional, signatários Asten, webhook idempotente, auditoria e recusa de segredos no estado público.

## Garantias desta versão

- O convite é gerado pelo modelo publicado no Estúdio, arquivado no Drive e anexado ao e-mail configurado pelo Master.
- Formulários personalizados preservam respostas e as disponibilizam como variáveis para etapas posteriores.
- Ata, Termo e Declaração só entram na Asten quando as condições do fluxo são satisfeitas; o Termo usa aluno(s) e orientador na mesma prioridade.
- Falhas parciais de Gmail, Asten ou Drive ficam registradas e a retentativa retoma a execução, sem liberar silenciosamente a próxima etapa.
- A criação de envelope usa outbox transacional no Supabase; concorrência é serializada e resultado ambíguo fica bloqueado para reconciliação, sem recriação automática.
- Cada modelo ativo é fixado por revisão e SHA-256. Uma edição direta no Drive exige nova publicação administrativa.
- Respostas de formulários não podem controlar destinatários, e seus valores são escapados quando inseridos no HTML de e-mail.
- Downloads privados verificam o vínculo atual com o processo e, na Vercel, usam transferência temporária pelo bucket privado do Supabase.
- Modelos e trabalhos enviados pelo navegador usam staging privado, tamanho, MIME, SHA-256, vínculo de sessão/finalidade e consumo controlado antes do Drive.
- O build publica somente `dist/client`; o bundle do servidor fica em `dist/server` e não contém sourcemap público.
- O desenvolvimento usa um perfil local separado, enquanto a produção recusa inicialização sem Supabase v6 e segredos obrigatórios.

## Homologações externas ainda obrigatórias

Os testes locais não utilizam credenciais e, portanto, não confirmam:

1. fidelidade visual da conversão DOCX → Google Docs → PDF;
2. entrega real pelo Gmail;
3. criação, assinatura e callback de um envelope real na Asten;
4. persistência, RLS, restauração e concorrência em um projeto Supabase remoto;
5. limites e reinicializações de Functions em uma implantação Vercel;
6. aparência renderizada em desktop, tablet, celular, zoom ampliado e leitor de tela.

Esses itens devem ser executados em homologação, com arquivos e destinatários controlados, seguindo `docs/TESTES_HOMOLOGACAO.md`. Nenhuma credencial deve ser incluída no ZIP ou enviada por atendimento.

O teste estático de acessibilidade não substitui a inspeção visual. A automação de navegador não estava disponível neste ambiente; portanto, não foi registrada aprovação visual que não pudesse ser comprovada.
