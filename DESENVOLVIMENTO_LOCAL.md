# Portal TCC no Mac

Revisão de 17/10/2026: a ação Asten em lote abre uma conferência administrativa
das declarações selecionadas e explica as pendências antes do envio. Fluxos distribui
os cartões por toda a largura, com quebra de linha quando necessário. Os ajustes
de modelos, upload e substituição documental estão em `docs/REVISAO_UI_2026-10-17.md`.

Revisão local de 16/10/2026: controles secundários sálvia, botões de título padronizados,
caixa do TCC, abas e editores ajustados. Fluxos tem cartão “+” após a última etapa,
pop-up ampliado, cartões brancos e tabela cinza-claro. Declarações têm alternativa Gov.br com devolução
do PDF e conferência manual no VALIDAR/ITI vinculada ao hash. Consulte
`docs/REVISAO_UI_2026-10-16.md` e `docs/ASSINATURA_GOVBR_CONFERENCIA_MANUAL.md`.
Os testes Gov.br usam processos e arquivos temporários isolados; não comprovam
assinatura real nem validação real no ITI. Sem push ou deploy nesta rodada.

Abra **Iniciar Portal TCC.command** com dois cliques. O navegador abre em
http://localhost:3000 quando o servidor estiver pronto. Mantenha a janela do
Terminal aberta; pressione **Control + C** nela para encerrar o servidor.
Abrir o atalho outra vez enquanto o portal estiver ativo apenas abre o navegador.

Na barra **Simulação de perfil**, escolha **Administrador Master** para testar a administração.
Os demais perfis permitem conferir a visão de alunos, orientadores e presidente.

Este ambiente usa os dados de demonstração já fornecidos pelo projeto. As
alterações de dados ficam em `.portal-data/`, e os segredos locais em `.env.local`.
Esses arquivos são ignorados pelo Git. Os registros reais e a configuração
publicada no Supabase não são copiados para este ambiente.

Alterações da interface atualizam pelo Vite; alterações do servidor reiniciam
automaticamente pelo `tsx watch`. Também é possível iniciar com `npm run dev`.
Não é necessário fazer build, commit, push ou deploy para testar cada alteração.

O fluxo atual de publicação é manual: a base possui deploy automático desativado
em `vercel.json` e workflows com acionamento manual. Salvar, testar e fazer commits
locais não publica nada. Faça push/publicação apenas quando a versão estiver
pronta e isso for solicitado. Não há agendamento de deploy diário neste ambiente.

Google, Gmail, Drive, Supabase remoto e Asten exigem homologação separada com
credenciais próprias de teste. O renderizador documental local é uma simulação;
não comprova o resultado dos DOCX oficiais nem uma assinatura real.

## Preparação e validação — 30/09/2026

- Base: versão 1.0.54, commit `6eb59ed`, obtida do GitHub. Trabalho local na branch `work/desenvolvimento-local`.
- Dependências instaladas; `brace-expansion` atualizado de 2.1.4 para 2.1.7. Auditoria npm: zero vulnerabilidades reportadas após a atualização.
- `.env.local` criado com segredos aleatórios independentes e permissão de leitura/escrita somente do proprietário. Nenhuma credencial de produção foi copiada.
- Servidor e canal de atualização automática limitados a `127.0.0.1`.
- Corrigida a renovação da sessão para manter a identidade do simulador após interações. Ajustado o espaço da barra de simulação para não ficar encoberta pelo menu lateral.
- `test:ci`: TypeScript, 297 testes unitários, 9 contratos, acessibilidade estática, finalização, build e verificação HTTP aprovados.
- `test:secure-flow`: 38 verificações aprovadas.
- Navegador: calendário público, troca de perfil, configurações do Master, lista e detalhes do TCC da aluna verificados. Sem erros JavaScript reportados nas verificações finais.
- Atualização da interface observada; reinício automático do servidor confirmado. Um rascunho foi salvo e recuperado após reiniciar, e depois removido.
- Encerramento do atalho confirmado sem deixar os listeners do portal ativos. Atalho da Mesa abriu uma nova execução.
- Sem push ou deploy. `vercel.json` e os workflows existentes preservados.

O status GitHub/Vercel do commit-base registrava `Deployment rate limited — retry in 24 hours.` Nenhuma nova tentativa de deploy foi feita. A publicação da versão 1.0.54 não foi confirmada.

O build passou com um aviso preexistente sobre arquivos JavaScript grandes; otimização de tamanho não foi incluída nesta preparação. A integração real com Supabase, Google/Gmail/Drive e Asten não foi homologada neste ambiente local.

## Retomada no Codex — 07/10/2026

Base atualizada para `31620e5` (package 1.0.78), a última correção da conversa
“Continuação Portal TCC 13”. As mudanças anteriores permanecem recuperáveis no
stash `recuperacao-local-antes-atualizacao-20261007`. Os ajustes locais de
autenticação, simulador e escuta em loopback foram reaplicados. Dependências e
lockfile seguem a base atual, que já inclui brace-expansion 2.1.7.

O atalho agora usa `npm run local`, compilando a interface antes de servir.
Para conferir a publicação, use `npm run parity:check`: nesta retomada, produção
respondeu `3834eca`, diferente da base local `31620e5`. Alterações locais não
commitadas também podem diferenciar a interface mesmo quando o SHA coincide.

Foi corrigido localmente um trecho duplicado e inválido em
`scripts/prepare-local.mjs`, preservando segredos existentes e usando quebras
de linha reais. A preparação histórica descrita acima não comprova a versão
atual; integrações reais continuam exigindo validação separada.

### Verificação desta retomada

- `npm run local`: preparação, build e servidor compilado aprovados.
- TypeScript e nove contratos de runtime/sessão aprovados.
- Fluxo seguro: 38 verificações aprovadas; scanner de segredos aprovado.
- Bootstrap isolado: cria segredos e preserva os valores na segunda execução.
- Navegador: calendário, Master, Configurações e perfil após recarregar confirmados.
- Atalho reutiliza o listener existente, sem duplicação.
- Pendências: referências a imagens locais retornam 404; geolocalização bloqueada
pela política de permissões. Build ainda avisa sobre chunks grandes.
- Não houve push, deploy ou alteração de dados de produção.

### Trabalho retomado da conversa Continuação Portal TCC 13

Primeiro estabilizar a base e revisar fontes concorrentes de modal, containers e
CSS. Depois verificar visualmente o padrão verde, faixa branca, branco-gelo e
caixas internas; fechamento e autosave; Cadastrar TCC; Detalhes do TCC e suas seis
áreas; Avaliação & Ata; Formulários; Documentos; Repositório; Indicadores.
Esses pedidos foram recuperados da conversa, mas não estão certificados como
concluídos nesta retomada. Publicação e integrações reais exigem etapa própria.

## Atualização local — 12/10/2026

Base atualizada para 1.0.79, commit `2fbbf92`, confirmado na `main` do GitHub
e no endpoint de saúde da produção. Ajustes locais reaplicados sem conflitos.
Cópia dos ajustes anteriores mantida no stash
`recuperacao-local-antes-1.0.79-20261012`; arquivos locais não rastreados preservados.

- TypeScript, build, 38 verificações do fluxo seguro e 15 testes específicos
  de sessão, HTTP e ações de assinatura aprovados.
- Paridade de commit com produção confirmada; ajustes e dados locais podem
  diferenciar a aparência do site publicado.
- Navegador: versão 1.0.79, troca para Master, Configurações e calendário confirmados.
- Permanecem referências locais a imagens ausentes (404), bloqueio de
  geolocalização pela política de permissões e aviso de chunks grandes no build.
- Servidor iniciado em modo de desenvolvimento em `127.0.0.1:3000`, com
  atualização automática da interface. Nenhum push, deploy ou migração remota.

## Desenvolvimento sem deploy — 13/10/2026

Base local atualizada para o commit `0e392dd` da `main` do GitHub, versão 1.0.79.
O trabalho local anterior foi preservado e possui cópia no stash
`recuperacao-local-antes-preparacao-20261013`.

O atalho da Mesa **Iniciar Portal TCC.command** e `npm run local` agora abrem o
modo de desenvolvimento: salvar a interface atualiza o navegador pelo Vite e
alterar o servidor reinicia a API pelo `tsx watch`. O servidor escuta somente
em `127.0.0.1:3000`. Abra o atalho novamente para reabrir o navegador sem criar
outro servidor. Mantenha a janela do Terminal aberta e use Control + C para parar.

Para conferir uma versão compilada, encerre o servidor e use
`npm run local:compiled`. Essa opção mantém os dados locais e também não publica.
A preparação aceita explicitamente `local_file`, preserva os segredos locais e
continua bloqueando provedores externos. Os testes unitários usam no máximo dois
processos simultâneos para evitar atrasos na inicialização dos servidores de teste.

As imagens estruturais do ambiente demonstrativo usam o arquivo de imagem
incluído no projeto, sem depender dos arquivos remotos da instalação publicada.
A localização respeita a política de permissões do navegador. Os dados já
existentes em `.portal-data/` foram preservados.

Validação desta preparação: 484 testes unitários, contratos de integração,
TypeScript, scanner de segredos, acessibilidade estática, finalização, build e
smoke HTTP aprovados. O fluxo seguro passou em 38 verificações. No navegador,
calendário público, configurações do Master e lista de TCCs da aluna foram
verificados, incluindo a abertura dos detalhes do TCC; a identidade permaneceu após recarregar, e uma nova carga ficou sem
erros de console. A atualização automática mostrou as imagens locais sem
recarregar manualmente. O reinício automático da API foi confirmado por mudança
do processo que escuta a porta; um rascunho temporário persistiu após esse
reinício e foi removido em seguida.

Control + C encerrou o servidor sem deixar listener na porta 3000. Abrir o
atalho da Mesa iniciou novamente o portal. A paridade consultada nesta preparação
confirmou `0e392dd` também em produção; os ajustes locais ainda não commitados
podem produzir diferenças de comportamento e aparência.

O build ainda avisa sobre bundles JavaScript grandes. Isso não bloqueou a
execução local. Supabase remoto, Google/Gmail/Drive, Asten e documentos oficiais
continuam exigindo homologação própria; os testes locais usam demonstração.
Nenhum push, deploy ou alteração de produção foi realizado.

## Massa de revisão visual — 13/10/2026

Foram mantidos os 13 TCCs existentes e adicionados 387, totalizando 400.
A massa inclui coautoria, orientadores, bancas internas e externas, títulos longos,
formatos e locais variados, sete estados do processo, 596 registros de acesso,
220 registros de assinatura simulados e 1.163 logs. E-mails novos usam
`example.invalid`; não foram gerados envelopes, PDFs oficiais ou envios reais.

Nenhuma defesa ocorre no sábado ou domingo, considerando America/Sao_Paulo.
Uma defesa demonstrativa antiga foi deslocada para segunda-feira. Há uma
duplicidade antiga em acessos, preservada sem consolidar dados distintos.

Configurações, modelos documentais, Estúdio, variáveis, e-mails, formulários e
fluxos configurados foram preservados. A geração só altera as coleções de dados.
O backup anterior está em `.portal-data/backups/antes-massa-visual-2026-10-13T17-41-46-521Z.json`.
O gerador `scripts/seed-local-review.mjs` exige ambiente local e servidor parado.
Reexecutá-lo recria apenas a massa `visual-demo-`, com novo backup; alterações
feitas nesses registros devem ser recuperadas pelo backup se necessário.

Asten: esta instalação permite validar a chave e guardá-la em memória local;
reiniciar o servidor perde essa conexão. Envio e piloto estão desabilitados e
não há callback configurado. A assinatura real exige homologação separada;
não se deve misturar esta massa fictícia com envios reais.

### Correção da seleção de repositório Asten — 13/10/2026

A conexão diferencia ausência de repositórios autorizados de múltiplos
repositórios disponíveis. No segundo caso, a tela oferece seleção por nome e ID.
O servidor reconsulta a conta e valida o ID escolhido antes de guardar a conexão;
repositórios de terceiros ou sem permissão continuam recusados.
TypeScript, build, 17 testes de contratos/conexão e 38 verificações do fluxo
seguro aprovados. A chave e a resposta reais do usuário ainda precisam ser
testadas; não houve assinatura, envio ou publicação.

## Modelos e revisão de interface — 16/10/2026

O catálogo demonstrativo local agora guarda os bytes dos DOCX enviados em
`.portal-data/modelos-locais/`, com hash SHA-256 e histórico no estado local.
O armazenamento é permitido somente com `local_file`, renderizador de teste e
runtime fora da produção/Vercel. A leitura exige administrador autenticado e
confere novamente o hash. Reiniciar o servidor preserva os modelos enviados.

Foram carregados pela interface os quatro DOCX fictícios já usados no piloto
isolado: convite, ata, termo e declaração. A prévia local mostra o DOCX original,
com seus marcadores e identificação de demonstração. A paginação do PDF oficial
continua exigindo a conversão e conferência no Google Drive.

O modelo de lista de acesso é um XLSX com cabeçalho, filtros, 100 linhas
formatadas, matrícula como texto e orientações em outra aba. O download usa uma
rota HTTP pública que entrega apenas o modelo vazio, sem consultar pessoas ou
processos. Com Google conectado, a ação Google Planilhas prepara uma base privada
em `00_SISTEMA` e oferece uma cópia formatada. Sem conexão, entrega o XLSX
compatível e informa como importá-lo no Google Planilhas. A integração direta foi
verificada com respostas simuladas; esta rodada não criou uma planilha real.

Validação: `test:ci` aprovado com 570 testes unitários, 17 contratos, TypeScript,
scanner de segredos, acessibilidade estática, finalização, build e smoke HTTP.
`test:secure-flow`: 40 aprovados. Navegador: download efetivo do XLSX (35.349
bytes), envio de planilha preenchida e preservação de zeros da matrícula, prévia
da carta-convite e do termo, prévia do e-mail, margens de 17 px e contador no
sálvia #8CB1A3. Os testes de contratos visuais foram atualizados para a paleta e
geometria solicitadas, sem restaurar os valores antigos. O build mantém aviso
sobre chunks grandes. Nenhum push ou deploy foi executado.

## Limpeza para teste oficial — 22/10/2026

Os 400 processos demonstrativos foram removidos desta base local, com recuperação
privada. Uma lista explicitamente vazia permanece vazia após reiniciar: o servidor
não deve recriar exemplos por considerar `[]` uma configuração ausente. O processo
oficial continua na base de produção; a limpeza local não copia dados nem segredos
de produção para o Mac. O simulador e seus testes isolados continuam disponíveis.

## Retomada de revisão — 22/10/2026

O modo local agora preenche uma base vazia com 13 TCCs demonstrativos no mês
corrente e em dias úteis, mantendo configurações e dados existentes. A opção
`PORTAL_LOCAL_REVIEW_DATA=true` exige desenvolvimento, `local_file`, autenticação
simulada e renderizador de testes. Produção e Vercel nunca recebem esses dados.
Bases com `PORTAL_DATA_DIR` explícito não são preenchidas automaticamente, salvo
opt-in adicional utilizado pelos testes isolados.

O perfil Presidente da Comissão mostra a Área do Presidente, com acesso à fila
correspondente; aluno e orientador continuam sem acesso administrativo. Os
exemplos, os PDFs simulados e as permissões locais não homologam Google ou Asten.
