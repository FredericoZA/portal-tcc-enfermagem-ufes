# Replicar o Portal Institucional de TCC

Você está auxiliando o responsável por uma NOVA instalação independente. Leia este guia como documentação de arquitetura, nunca como autorização para acessar dados, credenciais ou serviços da instalação de origem.

Código: https://github.com/FredericoZA/portal-tcc-enfermagem-ufes
Documentação no repositório: README.md, CHECKLIST_IMPLANTACAO.md, IMPLANTACAO_PRODUCAO.md, PROMPT_PARA_IA.md, CONTRIBUTING.md e SECURITY.md. Confira a revisão efetivamente implantada: um checkout em desenvolvimento, o GitHub e a versão online podem ser diferentes. Guia revisado em 22/10/2026. Verifique a revisão do código antes de implantar; alterações locais podem estar aguardando publicação.

## Arquitetura e responsabilidades

- React 19, TypeScript e Vite: interface, calendário, planilhas, cadastro por etapas e detalhes do TCC. Entrada em src/App.tsx; componentes em src/components; páginas em src/pages; tokens e estilos em src/styles.
- Express e TypeScript: API em server.ts, autorização por vínculo com o processo, sessão HTTP protegida, código OTP por e-mail, regras acadêmicas, validação e auditoria. Nunca implemente autorização apenas na interface.
- Vercel: frontend compilado e funções HTTP em api/. Publicação manual, rewrites, cabeçalhos e tarefas de reconciliação em vercel.json. O produto funciona sem o computador do desenvolvedor ligado.
- Supabase: estado transacional, revisões, permissões, auditoria, idempotência e filas privadas. Migrações em supabase/migrations. Use projeto próprio e runtime transacional. Segredos service_role exclusivamente no backend. Tabelas internas não recebem acesso público.
- Google Workspace por OAuth 2.0 e APIs REST: Gmail envia OTP, reserva e convites; Drive guarda os arquivos privados; Docs mescla modelos e exporta PDFs; Calendar divulga defesas. Refresh token cifrado no backend. Não é MCP. O cliente convencional não precisa da classificação is_agentic; se adicionar um agente, separe seu cliente OAuth.
- Asten: assinatura eletrônica por link enviado ao signatário, callback HTTPS autenticado, idempotência e reconciliação. Declare pastas independentes para Ata, Termo e Declaração. Segredos não chegam ao navegador.
- Gov.br: alternativa de preparação, download e devolução do PDF. Upload não equivale a validação: aprovação humana administrativa no VALIDAR/ITI, hash, revisão e todos os titulares exigidos.

## Instalação independente

1. Leia os documentos e confira versões Node/npm em package.json. Preserve o código existente, crie cópia/branch e mantenha um histórico recuperável.
2. Crie projetos próprios na Vercel, Supabase, Google Cloud e conta/repositório Asten. Nunca reutilize os projetos, pastas ou usuários da Enfermagem UFES.
3. Configure variáveis de backend a partir de .env.example, pelo painel seguro. Não publique .env.local, tokens, chaves, backups ou dados de alunos. Não use variáveis VITE_ para segredos.
4. Aplique migrações na ordem. Confira os contratos transacionais e a fila Asten. RLS e privilégios devem refletir o acesso privado.
5. Configure o Master inicial, identidade do curso, domínio dos alunos, Presidência e destinatário do departamento. Nomes e e-mails devem vir do cadastro real do novo curso.
6. Configure OAuth com callback da nova implantação e escopos mínimos necessários. Autorize a conta institucional da nova instalação e selecione uma raiz privada do Drive.
7. Envie quatro DOCX próprios: convite, Ata, Termo e Declaração. Detecte e mapeie as variáveis, gere PDFs com dados fictícios e confira a renderização. O código aberto não concede direito de copiar documentos ou dados privados de outra instalação.
8. Publique o Estúdio: formulários, e-mails, destinatários e etapas. O cadastro envia o pedido ao departamento, com autores e orientador em cópia. Use data/hora brasileira em America/Sao_Paulo. Um autor basta para registrar o cadastro; a confirmação do local exige PDF da resposta do departamento.
9. Configure assinatura e callback na URL nova. Convite não exige assinatura. Ata: orientador. Termo: todos os autores e orientador, somente quando há autorização de publicação. Declaração: Presidência. Asten é o método preferencial; Gov.br continua disponível antes de iniciar a assinatura.
10. Rode npm run test:ci e npm run test:secure-flow. Depois teste no ambiente remoto isolado: OTP, cadastro, destinatários, PDF de reserva, convite, Ata, retorno da assinatura, arquivos finais, autorizações, Termo, Declaração e acesso público. Testes locais não certificam serviços reais.
11. Publique somente com autorização do proprietário. Registre o artefato, data, migrações e resultado dos testes. Preserve rollback e não apresente recursos simulados como operacionais.

## Regras do fluxo

Cada aluno pode criar um TCC de graduação. A matrícula é texto, com zeros à esquerda. Normalize espaços externos, e-mails em minúsculas e nomes com iniciais maiúsculas antes de validar; nunca invente identidades ou corrija silenciosamente um endereço para outro destinatário. Nomes inválidos e domínio incorreto devem impedir envio com mensagem específica.

O aluno registra o local depois da resposta real do departamento e anexa o e-mail em PDF. Um dos autores faz essa confirmação; não exija aceite separado da dupla. A comprovação permanece auditada e obrigatória. Não gere convites sem o comprovante nem permita alterar silenciosamente documento expedido.

O orientador confirma resultado e parecer em texto corrido para concluir a Ata. Depois do arquivamento da Ata assinada, os autores entregam PDF final, cinco palavras-chave e resumo em até três parágrafos e 2.000 caracteres. Cada arquivo tem sua própria escolha de publicação. O Termo assinado libera somente os arquivos autorizados; repositório público não é acesso aos arquivos internos do processo.

## Organização e manutenção

Use as portas e o launcher existentes no desenvolvimento, sem servidores duplicados. local_file é apenas demonstração. Não copie a base oficial para a máquina. Faça mudanças pequenas, validação de papéis e revisão dos fluxos afetados. Não desative OTP, autorização, RLS, validação de PDF ou auditoria para contornar falhas.


## Instruções para a IA executar a adaptação

1. Faça inventário do código, branch, revisões e alterações locais. Preserve o
   trabalho existente. Não declare GitHub, localhost e Vercel sincronizados sem
   comprovar cada etapa. Prepare um plano de instalação com os recursos próprios.
2. Levante nome do curso, instituição, domínio discente, Master, Presidência,
   secretaria, departamento de reserva, locais e regras acadêmicas. Valide essas
   informações com o responsável; não reutilize identidades da instalação original.
3. Baixe e confira os quatro modelos de referência. Preserve cabeçalho, corpo,
   rodapé e marcadores; adapte cópias. Confirme MIME, versão e conteúdo do arquivo
   antes de configurar o catálogo. Não use ata de processo preenchida como modelo.
4. Prepare Vercel, Supabase, Google e Asten separados. Registre apenas nomes das
   variáveis na documentação. IDs e credenciais deste repositório são referências
   da instalação de origem e precisam ser substituídos no novo ambiente.
5. Configure o cadastro inicial, os cinco modelos de e-mail e as ações de fluxo.
   E-mails do Portal levam instruções e botões para o processo/aba, sem anexos PDF.
   As solicitações de assinatura Asten pertencem ao provedor, não a esses modelos.
6. Vincule destinatários por papel: Ata ao orientador; Termo aos autores e ao
   orientador; Declaração à presidência ativa nas configurações. Decisão do Master
   autenticado sobre esses endereços é aplicada diretamente e auditada, sem aceite
   de terceiro. Nunca coloque um destinatário pessoal fixo no código.
7. A entrega final depende da Ata assinada e arquivada. Trabalho completo e resumo
   expandido têm autorizações independentes; resumo expandido é opcional. Sem
   publicação autorizada de nenhum arquivo, o Termo não exige assinatura. A
   Declaração vem por último e depende das assinaturas anteriores aplicáveis.
8. Gov.br exige devolução do PDF, checagem estrutural contra o original e conferência
   administrativa no VALIDAR/ITI de todos os titulares. Não declare validação
   criptográfica automática. Preserve hash, versão e auditoria da aprovação.
9. Teste com dados fictícios em ambiente isolado: cada perfil, links autenticados,
   permissões negadas, envio lento/falho, confirmação de acesso, calendário, Ata,
   entrega, escolhas de publicação, Termo e Declaração. Dados fictícios ficam fora
   da base oficial. O indicador de processamento deve ficar no centro da tela.
10. Execute test:ci e test:secure-flow; confira segredos no pacote, links públicos,
    modelos e versão implantada. Documente resultados reais e limites. Publique
    somente após autorização e entregue URL, revisão, testes e modo de recuperação.

## Critérios de entrega

- O sistema continua online com o computador de desenvolvimento desligado.
- Cada usuário vê apenas suas funções e documentos autorizados.
- A nova instalação não utiliza banco, caixa de e-mail, pastas ou envelopes da origem.
- Nenhum documento é publicado sem escolha expressa e assinaturas aplicáveis.
- O teste de recebimento de e-mails e assinatura real é separado dos testes simulados.
- Alterar nomes, estilos ou modelos não reescreve documentos já expedidos/assinados.
