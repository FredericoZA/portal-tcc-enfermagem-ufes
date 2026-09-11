# Portal de TCC — comece aqui

Versão: **1.0.0-rc.10**, de 10 de setembro de 2026.

Este ZIP contém o código completo do portal, migrações do banco, testes, exemplos de configuração e instruções para implantação. Ele consolida a RC9 e a revisão final RC10. O trabalho nesta rodada foi realizado nos arquivos do sistema; esta entrega não é uma instalação já publicada e homologada nas contas da UFES.

## O fluxo que foi solicitado

1. O aluno autorizado inicia o formulário e informa autores, matrículas, orientador, coorientador opcional, banca, título, data, horário e local.
2. O fluxo publicado envia o pedido de reserva diretamente para o e-mail do departamento definido pelo Master.
3. O aluno retoma seu processo e declara que recebeu a confirmação do departamento. O portal registra quem declarou, quando e qual local foi autorizado. O comprovante PDF é opcional. O departamento não precisa entrar no portal.
4. Após a confirmação, o portal preenche o DOCX do convite com as variáveis do cadastro e envia o PDF aos destinatários configurados.
5. A partir do horário da apresentação, o orientador confere os dados cadastrados, marca a confirmação, lança a nota e registra o parecer. O portal preenche o DOCX da ata e inicia a rotina de assinatura Asten do orientador.
6. A entrega final e as escolhas de publicação continuam no processo. Havendo publicação, o termo é assinado pelos alunos autores e pelo orientador. A declaração é assinada pelo Presidente da Comissão.
7. O processo conclui depois que os documentos aplicáveis voltam assinados e são arquivados no Drive.

A aparência de tabelas e pop-ups usa configuração compartilhada. O Master altera o padrão no editor e publica para os demais usuários. Nos outros navegadores, a configuração é carregada ao recarregar ou entrar novamente. A organização de colunas e os textos próprios de cada tela são preservados.

## Para entregar a outra IA

Anexe o ZIP inteiro e peça: **“Leia COMECE_AQUI.md e execute PROMPT_PARA_IA.md. Preserve a estrutura existente e relate as evidências de cada etapa.”**

O roteiro detalhado é [PROMPT_PARA_IA.md](./PROMPT_PARA_IA.md). A arquitetura e a configuração já estão nos arquivos do pacote; a IA não precisa reconstruir o sistema do zero.

## Para abrir no computador

Instale Node.js 22 e npm 11. Extraia o ZIP para uma pasta e abra o terminal dentro dela.

Execute:

```bash
npm ci
```

Copie `.env.development.example` para `.env.local`. No macOS ou Linux:

```bash
cp .env.development.example .env.local
```

No PowerShell do Windows:

```powershell
Copy-Item .env.development.example .env.local
```

Depois:

```bash
npm run dev
```

Abra `http://localhost:3000`. Esse modo usa demonstração local. Os botões que dependem de Google ou Asten precisam das integrações configuradas para concluir suas ações.

## Para funcionar de verdade

Comece por [CHECKLIST_IMPLANTACAO.md](./CHECKLIST_IMPLANTACAO.md). Esse é o roteiro único para preparar a instalação e liberar o primeiro dia de uso.

Siga [IMPLANTACAO_PRODUCAO.md](./IMPLANTACAO_PRODUCAO.md), [PRIMEIRO_ACESSO.md](./docs/PRIMEIRO_ACESSO.md) e [HOMOLOGACAO_RC10.md](./docs/HOMOLOGACAO_RC10.md). Será necessário conectar Supabase, Vercel, Google e Asten nas contas do responsável pela instalação e cadastrar os quatro modelos DOCX do curso.

Os DOCX oficiais pertencem ao Master e são enviados pelo portal. Eles, as senhas, os tokens e os dados de alunos não estão neste ZIP. As dependências são restauradas pelo `npm ci`; os arquivos compilados são produzidos por `npm run build`.

Consulte [RELATORIO_VALIDACAO_RC10.md](./docs/RELATORIO_VALIDACAO_RC10.md) para distinguir o que foi testado localmente do que permanece **não confirmado**.
