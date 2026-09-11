# Atualização — fluxo institucional com OTP e documentos oficiais

- Login sem senha por código de seis dígitos enviado pelo Gmail conectado.
- Lista única de autorização: o Master libera alunos e o primeiro formulário inclui automaticamente todos os participantes do TCC.
- Acesso automático de aluno adicional, orientador, coorientador e banca quando cadastrados em um TCC.
- Limite de um TCC por aluno e proteção do acervo público.
- Confirmação obrigatória do local antes do convite e da agenda pública.
- Avaliação com resultado normativo e parecer restrito ao trecho variável da ata.
- Dados finais obrigatórios: cinco palavras-chave, trabalho, resumo sintético e autorização explícita.
- Asten exclusiva, acionada pelo botão **Assinar documento**, com signatários e prioridades corretos.
- Arquivamento automático do PDF assinado e conclusão após ATA e DECLARAÇÃO, mais o TERMO somente quando houver publicação.
- Nenhum modelo embutido: os quatro DOCX são obrigatoriamente cadastrados e versionados pelo Master; apenas a norma de referência acompanha o pacote.
- Preparação Vercel Node 22, migração Supabase, OAuth Google e guia de implantação.
- Personalização global/individual existente preservada e centralizada nas Configurações.
- Master e Presidente da Comissão são os únicos administradores globais, inclusive da lista de acesso. Não existe papel global de Coordenação de Curso.
- Produção inicia sem usuários, processos ou permissões de demonstração e falha de forma segura sem Master inicial e Supabase durável.
- Revogar um e-mail corta imediatamente a listagem, o detalhe e os downloads do processo, mesmo que a sessão ainda exista.
- Upload real do trabalho completo e do resumo expandido para a pasta privada do processo, com PDF validado, limite de 24 MB, SHA-256 e download autenticado.
- Carta-convite gerada no Drive e enviada por Gmail depois da confirmação do local; avaliação bloqueada antes do convite e do horário da defesa.
- Pasta raiz do Drive recusada quando possui compartilhamento por link ou domínio.
- Persistência Supabase ganhou revisão otimista para rejeitar sobrescrita silenciosa entre instâncias.
- Rotas legadas de buffer, aprovação e disparo Asten retornam `410`; o único início normal é a ação explícita no documento.
- Cabeçalhos de tabelas deixaram de afetar tabelas fora do contêiner padrão; pop-ups reais recebem tokens visuais comuns e o editor passou a se adaptar a telas menores.

Validações locais: TypeScript, build, OTP, sessão, autorização, limite de TCC, privacidade, variáveis documentais e regra de signatários. Chamadas reais Google, Asten, Supabase e Vercel exigem credenciais do ambiente e piloto controlado.

## Rodada rc.8 — operação recuperável e conferência antes da publicação

- rascunho do cadastro salvo no servidor, recuperação com revisão otimista e conferência obrigatória quando o Master altera o formulário;
- comprovante opcional da confirmação de reserva, privado, versionado e vinculado ao protocolo;
- amostra descartável do DOCX pelo Google, marca d'água e verificação de marcador, páginas, margem de assinatura e versão/hash do modelo;
- comparação rascunho/publicado, Central de Andamento e retomada que preserva ações externas já concluídas;
- prazos em dias úteis, feriados e lembretes limitados por destinatário, usando somente modelos publicados e sem anexos;
- alertas cadastrais não destrutivos e políticas editáveis de matrícula e SIAPE;
- relatório institucional PDF aprofundado e agregado, com gráficos, filtros, comparação, metodologia e privacidade;
- galeria visual preparada para linha de base aprovada e comparação por pixel, sem mascarar a ausência de navegador;
- documentação RC8 e passagem de bastão atualizadas para implantação independente e homologação com credenciais do proprietário.

## Rodada rc.3 — pacote do curso e operação contínua

- Configurações passou a publicar um pacote completo e versionado, validando aparência, formulários, modelos externos, e-mails, variáveis, fluxo e políticas.
- Formulários personalizados são executados dentro de cada TCC conforme o papel autenticado, com condição, validação duplicada no servidor, PDF no Drive e evento de continuidade.
- Ações do fluxo aceitam condições estruturadas e eventos personalizados, sem código específico do curso.
- Aparência publicada inclui tokens comuns e barreiras de contraste/acessibilidade para manter telas, tabelas e pop-ups coerentes.
- Entraram comparação/restauração do Estúdio e dos modelos, notificações, ICS, backup drill, retenção/guarda legal, LGPD, localização e saúde operacional.
- As integrações reais continuam declaradas como não confirmadas até homologação com credenciais do proprietário.

## Rodada v7 — consolidação para testes de implantação

- Primeiro acesso Google sem ciclo impossível: bootstrap único, vinculado ao e-mail Master do ambiente, antes do primeiro OTP.
- DTO público por lista branca, sem e-mails, IDs do Drive, destinatários, evidências ou responsáveis internos.
- PATCH genérico do aluno não altera orientador, banca, papéis nem campos administrativos da defesa.
- Backup e restauração com reautenticação recente, validação profunda, prévia e confirmação por hash; auditoria e administradores não são substituídos.
- Limite OTP por IP também consultado no Supabase, além da proteção local, e tempo de resposta neutro.
- Webhook Asten só consolida assinatura após consultar novamente o envelope no provedor.
- Cabeçalhos CSP, HSTS, anti-frame, `nosniff`, política de referência e permissões no Express/Vercel.
- Leitura de modelos e sincronização Google executadas exclusivamente pelo servidor, sem token OAuth no navegador e sem fallback por arquivo público.
- Cadastro de modelo por upload DOCX ou link/ID do Drive; cópia canônica para a pasta ativa e histórico com data/hora.
- Trabalho completo e resumo expandido com versão monotônica, nome canônico, SHA-256 e ciclo `CURRENT`/`SUPERSEDED`.
- Download verifica novamente a ausência de compartilhamento amplo no arquivo do Drive.
- Auditoria de download público usa inserção append-only leve, sem regravar o snapshot completo.
- Painel operacional para Gmail, fluxo, formulários no Drive e eventos Asten; callback exibido e copiável.
- Presets de pop-up agora alteram raio, borda, fundo e elevação; editor ganhou navegação por teclado e verificador WCAG de contraste.
- Homologação separa conexão básica, esquema normalizado e runtime transacional v4. O painel só aprova produção depois de detectar no banco a função de commit atômico e suas projeções.
- A declaração não tem mais modelo textual embutido: a Área do Presidente baixa somente o PDF assinado e arquivado no Drive por rota autenticada.
- A prévia do login foi alinhada ao acesso real por e-mail e código, sem CPF ou senha.
- O convite deixou de usar assunto e corpo fixos no servidor e agora exige o modelo de e-mail publicado pelo Master no Estúdio.
- O Estúdio não edita nem persiste o conteúdo dos documentos: guarda somente vínculo, variáveis e design; o arquivo ativo do Master no Drive é a fonte obrigatória.
- Runtime Supabase v4 incluído: commit PostgreSQL atômico, revisão otimista, histórico de hashes, governança e projeções normalizadas na mesma transação; produção bloqueada se a capacidade não estiver instalada.
- Testes locais: 31 verificações do fluxo seguro e 20 testes unitários/contratos, todos aprovados.

## Rodada rc.2 — portal aberto e configurável por curso

- Identidade institucional neutra e configurável, sem título, logotipo, endereço ou contato fixos de um curso no núcleo do produto.
- Períodos acadêmicos, importação CSV/XLSX, aceite de coautoria, conflitos de defesa, transferência administrativa e recursos graduais.
- Dossiê institucional com manifesto e hashes, consulta pública de autenticidade e indicadores sem exposição de dados pessoais.
- Tutorial conectado ao fluxo que o Master publica no Estúdio.
- Fluxo inicial sugerido alinhado ao cadastro único, confirmação do local, convite, avaliação do orientador, dados finais, Asten e conclusão.
- Aparência global publicada no servidor, herança real para itens vinculados e sobrescrita apenas quando o administrador desvincula o componente.
- Documentação de instalação por curso, referências acadêmicas, atualização, rollback, segurança e contribuição aberta.
