# Homologação de segurança e integrações — Portal de TCC

Este roteiro separa três níveis de evidência. Um item só pode ser marcado como aprovado no nível correspondente depois da execução registrada.

## 1. Teste local reproduzível

Execute em uma cópia limpa do projeto:

```bash
npm ci
npm run test:ci
npm run test:secure-flow
```

O teste `scripts/test-secure-flow.mjs` cria uma pasta temporária, inicia o portal em modo de desenvolvimento com autenticação de demonstração explicitamente habilitada e apaga o estado ao encerrar. Ele não chama Asten, Google Drive, Gmail, Supabase ou Vercel reais.

Cobertura automática:

| Regra | Evidência esperada |
|---|---|
| Administração | Master e Presidente recebem `200`; aluno, visitante e e-mail administrativo inventado recebem `401/403` |
| OTP | código de seis dígitos, cookie `HttpOnly`, consumo único e mensagem neutra para evitar enumeração |
| Um TCC por autor | a segunda criação pelo mesmo autor recebe `409` |
| Participação ilimitada | autor de um TCC pode ser examinador em outro; os dois papéis aparecem na autorização |
| Lista automática | estudantes, orientador, coorientador e examinadores entram pela origem `TCC_FORM` |
| TERMO condicional | sem publicação não há TERMO nem envio; com publicação ele aparece |
| Asten | ATA = orientador; TERMO = aluno(s) + orientador na ordem 1; declaração = Presidente |
| Arquivos privados | visitante recebe `401`; usuário sem vínculo recebe `404`, sem confirmação da existência |
| Arquivos públicos | rota pública separada aceita requisição anônima e aplica a opção de publicação por tipo |
| Webhook | segredo incorreto recebe `401`; repetição do mesmo evento retorna `duplicate: true` |
| Auditoria | pesquisa por e-mail e protocolo devolve somente registros correspondentes |
| Segredos | configurações rejeitam chaves sensíveis inclusive quando aninhadas; não há segredo `VITE_` |

Para executar somente os contratos estáticos:

```bash
STATIC_ONLY=true npm run test:secure-flow
```

## 2. Homologação assistida com credenciais de teste

Use projetos e contas de homologação. Nunca use um TCC real, token de produção ou destinatários reais no primeiro ensaio.

### Google Workspace, Drive e Gmail

1. Autorizar uma conta Google exclusiva de homologação.
2. Confirmar que a pasta raiz e as subpastas foram criadas com acesso restrito à conta Master.
3. Cadastrar um DOCX de teste por upload. Se a instalação tiver habilitado conscientemente a importação por link, repetir o teste com um arquivo preexistente após a nova autorização Google.
4. Gerar o documento e comparar, página a página, o DOCX e o PDF exportado pelo Google Docs.
5. Confirmar cabeçalho, rodapé, tabelas, imagens, quebras de página e assinaturas reservadas.
6. Enviar carta-convite apenas a endereços controlados.
7. Confirmar no Drive o PDF dos formulários, documento gerado e documento assinado com código do TCC e nome do aluno.
8. Tentar abrir o arquivo diretamente com conta não autorizada: o Drive deve negar.
9. Tentar baixar pelo portal como participante, não participante e visitante.

Evidências a guardar: IDs dos arquivos/pastas, hash SHA-256, destinatário controlado, horário, resposta HTTP e capturas sem tokens.

### Asten

1. Usar token de uma conta de homologação e repositório exclusivo.
2. Configurar URL de callback HTTPS e segredo forte independente.
3. Criar três PDFs inofensivos: ATA, TERMO e declaração.
4. Conferir no envelope os destinatários antes de encaminhar.
5. Confirmar que aluno(s) e orientador do TERMO têm a mesma ordem/prioridade.
6. Assinar com contas controladas.
7. Repetir o callback e confirmar idempotência.
8. Confirmar arquivamento do PDF assinado no Drive e correspondência do hash.
9. Revogar/rotacionar o token de homologação ao final.

Não registrar o token em vídeo, captura, log, banco em texto aberto ou ferramenta de atendimento.

### Supabase

1. Aplicar todas as migrações em um projeto vazio de homologação.
2. Executar a conexão assistida no portal.
3. Confirmar que o bucket de staging foi criado como privado e não possui leitura anônima.
4. Enviar um DOCX e um PDF por URL assinada; conferir vínculo à sessão/finalidade, consumo único, tamanho, MIME, SHA-256 e remoção após o consumo.
5. Criar dois TCCs concorrentes tentando repetir o mesmo autor; apenas um deve confirmar.
6. Verificar RLS/revogação: chave pública não pode listar processos, arquivos, tickets, OTPs, assinaturas nem auditoria.
7. Reiniciar o servidor e confirmar persistência de processo, autorização, assinatura e auditoria.
8. Simular conflito de revisão e confirmar `409`, sem perda silenciosa.
9. Exportar backup e restaurar em projeto isolado.

### Vercel

1. Vincular projeto de homologação.
2. Cadastrar variáveis por ambiente; segredos nunca devem ter prefixo `VITE_`.
3. Implantar uma Preview e executar `npm run test:secure-flow` localmente contra o mesmo commit.
4. Validar que autenticação de demonstração e armazenamento OTP local estão desativados.
5. Reiniciar/redistribuir a função e confirmar persistência pelo Supabase.
6. Enviar DOCX e PDF nos limites documentados e confirmar que o binário não atravessa a função como Base64.
7. Examinar logs para garantir ausência de token Asten, código OTP, cookie, conteúdo Base64 e dados completos de aluno.
8. Confirmar no painel de Cron Jobs a execução diária de `/api/cron/storage-cleanup`, o descarte dos objetos temporários expirados e o recálculo dos dois arquivos vivos.
9. Executar a atualização manual em Configurações → Operação contínua e confirmar que os dois arquivos mantêm os mesmos IDs no Drive enquanto criam novas revisões.
10. Confirmar que os arquivos estatísticos não contêm nomes, e-mails, matrículas, títulos ou resumos e que grupos temáticos com menos de três ocorrências aparecem agregados.

## 3. Casos manuais de autorização

| Identidade | Listagem/detalhe privado | Download privado | Configurações | Assinar |
|---|---:|---:|---:|---|
| Visitante | Não | Não | Não | Não |
| Aluno autor | TCC próprio | TCC próprio | Não | TERMO, somente se houver publicação |
| Orientador | TCC vinculados | TCC vinculados | Não | ATA e TERMO dos TCCs vinculados |
| Coorientador/examinador | TCC vinculados | Apenas documentos visíveis ao papel | Não | Não, salvo regra documental futura explícita |
| Presidente | Todos | Todos | Sim | Declaração e administração máxima |
| Master | Todos | Todos | Sim | Administração máxima |

### Revogação

1. Desativar um acesso na lista.
2. Repetir listagem, detalhe e download usando uma sessão já aberta.
3. O servidor deve negar imediatamente pelo estado atual da autorização; não basta esconder botões no navegador.
4. O evento deve aparecer na auditoria com ator, alvo, data e estado anterior/posterior.

### Publicação e retirada

1. Sem publicação: trabalho completo fica privado, resumo expandido fica privado e TERMO não é criado.
2. Trabalho público: somente o trabalho completo é baixável anonimamente.
3. Resumo expandido público: somente o resumo expandido é baixável anonimamente.
4. Retirada administrativa: acesso público cessa imediatamente, o arquivo privado permanece preservado e o evento é auditado.
5. URL pública não pode revelar ID interno do Drive nem redirecionar para compartilhamento público do Drive.

## Critérios de bloqueio de produção

A publicação deve ser bloqueada se qualquer item abaixo estiver ausente:

- Master inicial definido e Presidente cadastrado;
- Supabase durável, migrações aplicadas e restauração testada;
- OTP durável e Gmail conectado;
- Google Drive privado e estrutura criada;
- quatro modelos cadastrados pelo Master;
- Asten conectada, callback autenticado e piloto concluído;
- `PORTAL_SESSION_SECRET`, `PORTAL_OTP_PEPPER`, `PORTAL_SECRET_ENCRYPTION_KEY` e `ASTEN_WEBHOOK_SECRET` fortes e distintos;
- autenticação de demonstração e fallbacks locais desativados;
- política LGPD publicada e retenção configurada;
- teste local, teste responsivo/WCAG e ensaio com credenciais de homologação aprovados.

## Limite desta validação

O script local comprova regras do código e respostas do servidor isolado. Ele não comprova disponibilidade, entrega final de e-mail, fidelidade visual no Google Docs, assinatura real na Asten, persistência real no Supabase ou comportamento da implantação Vercel. Esses itens exigem as credenciais e evidências do nível 2.
