# Política de segurança

O código-fonte deste projeto é público. Credenciais, tokens, chaves criptográficas, documentos privados e dados operacionais não fazem parte do código-fonte e devem permanecer fora do Git.

## Relato responsável

Não abra uma issue pública com e-mails, documentos, tokens, URLs assinadas, dados pessoais ou passos exploráveis.

Use preferencialmente o recurso **Private vulnerability reporting** do GitHub deste repositório. Se ele não estiver disponível, envie o relato ao mantenedor por um canal privado antes de divulgar detalhes técnicos.

Informe, quando possível: versão, rota afetada, impacto, reprodução mínima sem dados reais e sugestão de correção. Remova ou masque qualquer dado real de aluno, servidor, processo, token ou documento.

## Política obrigatória de segredos

É proibido versionar, colar ou publicar segredos reais em código, commits, branches, pull requests, issues, discussions, wiki, releases, artefatos públicos, logs ou capturas de tela.

Incluem-se nessa proibição, entre outros:

- `SUPABASE_SECRET_KEY` e `SUPABASE_SERVICE_ROLE_KEY`;
- `GOOGLE_OAUTH_CLIENT_SECRET`, refresh tokens e access tokens Google;
- token/API key da Asten e `ASTEN_WEBHOOK_SECRET`;
- `PORTAL_SESSION_SECRET`, `PORTAL_OTP_PEPPER` e `GOOGLE_OAUTH_STATE_SECRET`;
- `PORTAL_SECRET_ENCRYPTION_KEY`, `PORTAL_SECRET_ENCRYPTION_KEY_V2`, `PORTAL_VERIFICATION_SECRET`, `PORTAL_UPLOAD_BINDING_SECRET` e `CRON_SECRET`;
- tokens Vercel, chaves privadas, certificados privados, service accounts e arquivos de credenciais de provedores.

Segredos de produção devem existir somente no local apropriado do provedor: variáveis de ambiente protegidas da Vercel para configuração exclusiva do servidor e armazenamento cifrado do Supabase para tokens persistidos pelo próprio Portal. Tokens de integração persistidos pelo sistema usam AES-256-GCM e não devem ser reproduzidos em documentação ou configuração pública.

Nenhum segredo pode usar prefixo `VITE_`, ser enviado ao navegador, entrar em `localStorage` ou ser serializado em respostas públicas. IDs de projeto, URLs públicas, nomes de bucket e IDs de pastas não devem ser tratados como credenciais; a autorização real deve continuar baseada em chaves privadas, sessão e permissões do provedor.

## Rotação criptográfica

`PORTAL_SECRET_ENCRYPTION_KEY` permanece como chave v1. O Portal aceita opcionalmente `PORTAL_SECRET_ENCRYPTION_KEY_V2` como chave ativa para novos segredos e backups. Quando v2 estiver configurada, a chave v1 deve permanecer disponível até que todos os registros e backups necessários tenham sido migrados ou expirado. As duas chaves precisam ser diferentes entre si e diferentes dos demais segredos de produção.

A ativação de v2 não deve ser feita apagando v1 no mesmo passo. Primeiro configure v2, valide leitura de dados históricos e criação/restauração de backup; somente depois planeje a retirada da chave anterior em uma migração específica e reversível.

## GitHub Actions

Os workflows deste projeto devem permanecer sem credenciais de produção sempre que possível. Não copie segredos de Vercel, Supabase, Google ou Asten para arquivos YAML ou comandos de workflow.

Se no futuro uma automação realmente exigir segredo, ele deverá ser cadastrado exclusivamente no armazenamento criptografado de Secrets/Environments do GitHub, com privilégio mínimo, escopo restrito, rotação definida e sem impressão em logs. Tokens persistentes do Google Workspace, token Asten e chave administrativa do Supabase não devem ser usados em CI comum.

Actions usadas pelos workflows devem ser fixadas por SHA imutável. O checkout deve manter `persist-credentials: false` quando o job não precisar escrever no repositório.

## Barreiras preventivas

- `.gitignore` bloqueia `.env`, arquivos de credenciais, chaves e certificados locais.
- `npm run test:secrets` examina arquivos versionados e bloqueia padrões conhecidos ou valores literais em variáveis críticas.
- `npm run test:ci` executa a verificação de segredos antes da suíte normal.
- `Security sweep` repete semanalmente auditoria de dependências, segredos, tipos, testes unitários e fluxo seguro mesmo sem novos commits.
- GitHub Secret Scanning e Push Protection devem permanecer habilitados.
- Dependabot monitora dependências npm e GitHub Actions.
- CodeQL executa análise estática de segurança de JavaScript/TypeScript.
- Um bloqueio de Push Protection não deve ser contornado para um segredo real. Remova o segredo e faça nova tentativa.

Essas barreiras são complementares; nenhuma substitui a separação correta das credenciais do código.

## Documentos enviados

Uploads de PDF e DOCX entram primeiro no armazenamento privado temporário e são vinculados à sessão, finalidade e processo. Antes do consumo, o Portal valida tamanho, MIME, checksum e estrutura e aplica uma barreira determinística contra conteúdo ativo de maior risco: JavaScript/Launch/arquivos incorporados em PDF, macros/ActiveX, executáveis/scripts incorporados e referências externas perigosas em DOCX.

Essa barreira reduz a superfície de ataque, mas não deve ser descrita como antivírus completo. Um motor antimalware isolado pode ser acrescentado no futuro sem enviar trabalhos acadêmicos para serviços públicos de análise.

## Resposta a incidente

Se uma credencial real entrar no Git, considere-a comprometida mesmo que o commit seja apagado logo depois. A sequência obrigatória é:

1. revogar ou rotacionar a credencial no provedor de origem;
2. confirmar que a aplicação usa a nova credencial;
3. remover o valor do código e, quando necessário, higienizar o histórico;
4. revisar logs e alertas de Secret Scanning para verificar uso indevido;
5. documentar a correção sem reproduzir o segredo.

Somente remover o texto do commit não torna novamente segura uma credencial já publicada.

## Controle de acesso

Toda rota privada exige sessão autenticada e autorização por função ou vínculo no processo. O Google Drive permanece privado ao proprietário da instalação; o portal atua como mediador dos downloads. Revogação de participante impede novas consultas, detalhes e downloads, sem apagar o histórico de auditoria.

A pasta raiz do Drive destinada ao Portal não pode possuir compartilhamento amplo por `anyone` ou domínio. O backend deve falhar fechado quando detectar essa condição.

Contas administrativas dos provedores — GitHub, Google Workspace, Supabase e Vercel — devem usar MFA forte, preferencialmente passkey ou chave de segurança física, e possuir códigos de recuperação armazenados fora do dispositivo principal. Essa proteção é uma responsabilidade da conta e não pode ser substituída por controles da aplicação.

## Homologação

Antes de dados reais, execute:

```bash
npm run test:secrets
npm run test:ci
npm run test:secure-flow
```

Depois siga `docs/TESTES_HOMOLOGACAO.md`. Use PDFs sem valor jurídico e destinatários controlados no primeiro teste Asten.

## Suporte de versões

A instalação deve acompanhar a versão mais recente publicada pelo mantenedor. Correções de segurança não são garantidas para snapshots modificados sem testes ou para implantações com migrações incompletas.
