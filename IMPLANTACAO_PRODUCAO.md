# Implantação do Portal de TCC

Versão atual: **1.0.0-rc.10**. Para a sequência de implantação e liberação, comece em `CHECKLIST_IMPLANTACAO.md`. As evidências estão em `docs/RELATORIO_VALIDACAO_RC10.md`.

## Ordem obrigatória

1. Crie um projeto Supabase exclusivo desta instalação e execute, pela ordem dos nomes, **todas** as migrações de `supabase/migrations`. Não compartilhe banco ou bucket com outro curso.
2. Crie o projeto Vercel usando este diretório. Selecione Node.js 22.
3. Cadastre na Vercel todas as variáveis de `.env.example`. Gere valores independentes para sessão, OTP, OAuth state, criptografia, webhook e `CRON_SECRET`; não reutilize segredos entre ambientes. O cron diário autenticado remove resíduos expirados do staging privado e recalcula os dois arquivos de inteligência contínua.
4. No Google Cloud, ative Google Drive API, Google Docs API, Gmail API e Google Calendar API. Crie credenciais OAuth Web e cadastre exatamente o callback exibido em Configurações.
5. No modal de acesso, use **Autorizar Google e continuar**. Esse bootstrap aparece somente enquanto nenhuma conta Google estiver conectada e aceita exclusivamente a conta definida em `PORTAL_BOOTSTRAP_MASTER_EMAIL`. Depois do retorno OAuth, solicite o primeiro código e entre no portal.
6. Publique a identidade da instalação em Configurações. O portal criará a pasta raiz informada (padrão neutro `PORTAL_TCC`) e suas subpastas vazias. O programa não fornece modelos.
7. Em Configurações → Modelos e Variáveis, o Master ou o Presidente deve cadastrar os quatro modelos por upload DOCX. O portal copia o arquivo para a pasta ativa e move a versão anterior para o histórico. A importação de arquivo preexistente por link só aparece quando `GOOGLE_ALLOW_EXISTING_MODEL_LINKS=true`; essa opção acrescenta o escopo `drive.readonly`, exige nova autorização Google e deve ser habilitada apenas após avaliação administrativa.
8. Ative `ASTEN_INTEGRATION_ENABLED=true`, configure callback e webhook e, já autenticado como Master, cole o token da conta em Configurações → Sincronização → Asten.
9. Confirme que o bucket de staging do Supabase está privado. Ele é uma área temporária de transferência, não o arquivo institucional: uploads são autorizados por URL assinada, validados no servidor e removidos depois da cópia definitiva no Drive.
10. Em Configurações → Operação contínua, clique em **Atualizar os dois arquivos**. Confirme no Drive os arquivos `MEMORIA_CONTINUA_FLUXOS_E_MELHORIAS.md` e `PANORAMA_ESTATISTICO_DOS_TCCS.md`, ambos dentro de `00_SISTEMA/01_INTELIGENCIA_CONTINUA` e sem compartilhamento público.
11. Na Oficina, gere a amostra real de cada modelo pelo Google, confira o PDF página a página, configure o calendário útil e compare o rascunho com a revisão publicada.
12. Cadastre os alunos autorizados. Faça um piloto completo com um TCC fictício, e-mails controlados e PDFs sem valor jurídico antes de abrir o sistema.

## Acesso

- Páginas públicas: calendário, repositório e tutorial.
- Aluno: precisa ser liberado manualmente pelo Master; recebe código por Gmail; pode autuar um único TCC.
- Orientador, coorientador, aluno adicional e banca: entram automaticamente na mesma lista de autorização quando o primeiro formulário do TCC é salvo.
- Master e Presidente da Comissão: acesso administrativo máximo a processos, configurações, integrações e auditoria.
- A sessão é um cookie `HttpOnly`, `Secure` e `SameSite=Lax`. O código expira em 10 minutos, só pode ser usado uma vez e não é armazenado em texto puro.

## Segurança operacional

- Chaves Supabase, Google e Asten nunca usam prefixo `VITE_` e nunca vão para o navegador.
- Tokens Google e Asten são cifrados com AES-256-GCM antes de serem persistidos.
- O `SUPABASE_SECRET_KEY` permanece exclusivamente no servidor. O navegador recebe apenas uma URL assinada temporária e vinculada ao arquivo esperado; o bucket nunca pode ser público.
- Google Drive é o arquivo definitivo. O Supabase Storage é usado somente como transporte temporário para evitar limites de corpo das funções Vercel.
- Asten é a única assinatura eletrônica do fluxo. Carta-convite não é assinada.
- ATA: orientador, prioridade 1. TERMO: aluno(s) e orientador, todos na prioridade 1. DECLARAÇÃO: presidente da comissão, prioridade 1.
- A criação do envelope usa uma outbox transacional no Supabase. Duas instâncias não criam dois envelopes; um resultado ambíguo fica em estado de reconciliação e não é reenviado automaticamente.
- Cada modelo ativo do Drive é fixado por revisão e SHA-256. Editar o arquivo diretamente exige republicá-lo no portal antes de gerar novos documentos.
- Uma ação de documento publicada no fluxo pode gerar e enviar automaticamente o arquivo quando o marco seguro for concluído. O botão **Assinar documento** aciona a mesma rotina idempotente quando a etapa admite execução manual; ele não permite trocar modelo, destinatário, prioridade ou signatário no navegador. A Central de Assinaturas serve apenas para acompanhar e, pelo Master ou Presidente, reprocessar uma falha já registrada.
- Não reutilize segredos entre ambientes e não envie tokens por chat ou e-mail.

## Homologação mínima

- Solicitação, expiração, tentativa inválida e consumo único do OTP.
- Bloqueio de e-mail fora da lista e acesso de membro externo já vinculado.
- Bloqueio do segundo TCC pelo mesmo aluno.
- Pendência e confirmação do local antes da carta-convite e do calendário.
- Recuperação do rascunho, conflito de versão e comprovante privado da confirmação da reserva.
- Geração da ATA após avaliação; TERMO e DECLARAÇÃO após dados finais.
- Amostra dos quatro modelos, prazos em dias úteis, lembretes limitados e Central de Andamento.
- Idempotência Asten, assinaturas paralelas do TERMO, callback e PDF assinado no Drive.
- Upload direto de um DOCX de 12 MB e de um PDF de 24 MB ao staging privado, sem Base64 no corpo da função Vercel; consumo único, verificação de hash e remoção do objeto temporário.
- Privacidade: apenas TCC concluído e expressamente público aparece sem login.
- Relatório institucional filtrado sem nomes, e-mails, matrículas, títulos ou resumos.

As chamadas reais às plataformas só podem ser consideradas confirmadas após esse piloto no ambiente do proprietário das credenciais.

No desenvolvimento local, copie `.env.development.example` para `.env.local`; o servidor carrega esse arquivo sem substituir variáveis já definidas no sistema. Esse perfil simulado nunca deve ser enviado à Vercel. O build mantém `dist/client` como único conteúdo público e grava o servidor separadamente em `dist/server`, impedindo que o bundle da API seja servido como arquivo estático.

## Limite desta versão

O runtime v6 realiza um commit atômico do agregado com revisão otimista e atualiza, na mesma transação, as projeções normalizadas de usuários, autorizações, processos, autoria, participantes, arquivos-fonte, assinaturas, e-mails, fluxos, auditoria, identidade da instalação, períodos, aceite de coautoria e transferências administrativas. A mesma versão inclui a outbox transacional da Asten. Em conflito, o servidor recarrega o snapshot vencedor e rejeita a mutação obsoleta. A aplicação bloqueia a inicialização em produção se essas capacidades não forem detectadas.

A execução sob carga em um projeto Supabase, a transferência de arquivos grandes, a fidelidade do Google Docs, a entrega do Gmail, a assinatura Asten e o comportamento em múltiplas instâncias Vercel permanecem **não confirmados** até o piloto do proprietário das credenciais. A inspeção visual automatizada também não foi concluída neste ambiente e deve ser feita no endereço de homologação.
