# Instrução de continuidade para a IA de implantação

Revisão documental: 03/11/2026.

Você recebeu o código do Portal Institucional de TCC. Preserve o sistema existente e trabalhe sobre a revisão recebida. Não substitua a aplicação por uma demonstração nova. A versão de execução está em `package.json`; identifique também o commit e as alterações locais antes de declarar que o código coincide com GitHub ou Vercel.

## Fonte de verdade e leitura

Leia `AGENTS.md`, `README.md`, `CHECKLIST_IMPLANTACAO.md`, `COMECE_AQUI.md`, `IMPLANTACAO_PRODUCAO.md`, `.env.example`, `SECURITY.md`, `docs/FLUXO_ATUAL_2026-10-26.md` e `public/replicacao/GUIA_DE_INSTALACAO.md`. Consulte ainda `docs/PRIMEIRO_ACESSO.md`, `MODELOS_E_VARIAVEIS.md`, `INTEGRACAO_ASTEN_DRIVE.md` e `docs/ATUALIZACAO_E_ROLLBACK.md`.

RC5 a RC10 e relatórios de revisões anteriores são históricos. Não use seus resultados como evidência da instalação atual. O código, as migrações aplicadas, a configuração publicada e o runtime efetivamente implantado precisam ser conferidos separadamente. Se faltar evidência de uma integração, registre “não confirmado”.

## Arquitetura existente

| Local | Responsabilidade |
|---|---|
| `src/pages`, `src/components`, `src/styles` | Interface React, telas públicas, editor do Master e aparência compartilhada. |
| `src/components/AdvisorEvaluationPanel.tsx` | Registro de conceito e parecer do orientador. |
| `src/services/apiClient.ts` | Comunicação entre navegador e API. |
| `server.ts`, `api/` | API Express, autorização, persistência e entradas Vercel. |
| `server/workflow` | Eventos, bloqueios, avaliação, geração, prazos e recuperação. |
| `server/integrations` | Google, Asten e persistência Supabase. |
| `supabase/migrations` | Migrações incrementais do estado, permissões, transporte e filas. |
| `scripts` | Preparação local, compilação, testes e pacote de distribuição. |

Preserve `package-lock.json` e use as versões Node/npm definidas no projeto. Vercel executa o produto online; ele deve funcionar com o computador do desenvolvedor desligado. Supabase guarda registros, revisões, permissões, auditoria e filas. Os arquivos definitivos ficam no Google Drive. O transporte temporário de arquivos usa armazenamento privado com limpeza; não transforme esse staging em arquivo permanente dos TCCs.

## Regras que a implantação deve preservar

- Cada instalação tem identidade, contas, projetos, pastas e segredos próprios. Não reutilize a base ou os arquivos privados da origem em outro curso.
- O autor cria o TCC com sua sessão autenticada e acesso cadastrado ativo. O e-mail do primeiro autor corresponde à sessão. Mantenha as regras de unicidade e os bloqueios de acesso existentes.
- O protocolo e a data de criação são imutáveis e definidos pelo sistema. Títulos, nomes e instituições seguem a normalização implementada; siglas e/ou acrônimos explícitos em título e instituição usam asteriscos, sem exibir os delimitadores nos documentos.
- A reserva escolhe um único local por pedido de 1h30. Auditório e sala de reuniões são homologados pelo departamento; outro local é confirmado pelo orientador. O aluno não declara uma confirmação que recebeu fora do sistema e não precisa anexar comprovante.
- Mapa de salas, aulas, eventos e horários do prédio devem ser considerados para evitar retrabalho. Conversar previamente com o departamento é recomendação, não obrigação de comparecer.
- Os botões de aceite e recusa vão somente ao responsável. O grupo recebe comunicação informativa. O registro da resposta gera comprovante e avisos, sem pedir uma segunda confirmação idêntica.
- O convite vai conjuntamente aos examinadores e ao coorientador, quando houver. Não duplique mensagens iguais por destinatário.
- O orientador registra conceito e parecer; a avaliação e a nota acadêmica são realizadas no Portal do Professor. Os conceitos são Aprovado, Aprovado com ressalva e Reprovado.
- Registrar o conceito e confirmar a entrega apenas encaminham para Documentos administrativos. Essas ações não iniciam automaticamente uma assinatura. O usuário escolhe Asten ou Gov.br no cartão do documento.
- Convite e comprovante não são assinados. A ata é assinada somente pelo orientador. Havendo publicação, o termo é assinado por todos os autores e orientador. A declaração é assinada pela presidência da Comissão.
- A entrega de trabalho completo, resumo e palavras-chave é obrigatória nos processos novos. O PDF do resumo expandido é opcional. Publicação dos PDFs é opcional e independente por arquivo. Sem autorização de nenhum PDF, não há termo.
- O texto do resumo do catálogo não deve ser ocultado com base na autorização de publicação dos PDFs. E-mails, matrículas, registros e arquivos restritos continuam protegidos.
- Pelo Gov.br, o orientador reúne as assinaturas exigidas do termo e devolve o PDF completo. Preserve a função administrativa do Master sem dispensar assinaturas. Envio isolado não conclui a conferência administrativa no VALIDAR/ITI.
- Criar envelope, enviar e-mail ou anexar PDF não comprova assinatura. Exija retorno válido, signatários previstos, revisão atual e arquivamento dos bytes conferidos no Drive. Não repita automaticamente um envelope de resultado incerto.
- A entrega final bloqueia a reabertura da avaliação. Documentos concluídos bloqueiam a edição do repositório conforme o fluxo. Não remova bloqueios para contornar um erro.
- Os quatro DOCX ativos são externos, versionados e vinculados por hash. Não invente modelos institucionais nem reescreva PDFs assinados.
- Legados usam as mesmas telas, código NNN - Legado e campos ausentes preservados. Eles têm instrumento de avaliação como sexto cartão administrativo, quando localizado. Não gere novo instrumento, novas assinaturas ou novos avisos ao importar o histórico.
- Segredos nunca entram em código, ZIP, GitHub, capturas, logs ou variáveis VITE_. Preserve autorização no servidor, RLS, auditoria, limites de uso e validação dos arquivos.

## Sequência de execução

1. Identifique a instalação, a revisão, os dados existentes e a recuperação disponível. Preserve mudanças ainda não commitadas. Não crie projetos duplicados.
2. Instale com `npm ci`. Execute `npm run test:ci` e `npm run test:secure-flow`; registre os comandos, o resultado e a versão do Node.
3. Confira e aplique apenas as migrações pendentes necessárias. Verifique contratos transacionais, RLS, privilégios das funções, bucket privado, revisões, fila Asten e limpeza do transporte temporário.
4. Configure as variáveis próprias na Vercel a partir de `.env.example`. Não publique a configuração de demonstração local.
5. Configure o Master, identidade, presidência, destinatários e OAuth do novo domínio. Conecte a conta Google institucional e o Asten pelas funções existentes do Portal.
6. Cadastre os quatro DOCX próprios. Confira variáveis, formatos, PDFs e os destinos no Drive. Se faltar um item, identifique-o; não use dados de alunos como modelo nem solicite segredos da origem.
7. Publique uma configuração coerente de formulários, e-mails, ações e aparência. Preserve os componentes visuais compartilhados e o envio conjunto das mensagens iguais.
8. Execute piloto real com destinatários controlados: um autor ou dupla; reserva aceita, recusada e alterada; convite; conceito; ata; entrega com e sem publicação; termo aplicável e declaração. Confira o armazenamento e os limites de edição.
9. Confira a interface no navegador, em computador e celular, incluindo teclado, foco, zoom, imagens dos manuais e links. Use dados fictícios nas capturas.
10. Publique somente com autorização do responsável. Entregue URL, revisão, migrações, configuração, testes executados, resultados reais, pendências e recuperação.

## Evidência de encerramento

Relate separadamente execução local, GitHub, implantação Vercel, persistência Supabase, e-mails, PDFs gerados, assinaturas, arquivamento Drive e inspeção visual. Para cada item, indique aprovado, reprovado ou não confirmado, com evidência. Compilar e passar em testes simulados não comprovam o funcionamento das integrações reais.
