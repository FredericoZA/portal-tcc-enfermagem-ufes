# Revisão e publicação de 20/10/2026

Atende aos 27 comentários de revisão enviados em 19/10 e ao ajuste da solicitação de reserva.

## Alterações

- Login sem o parágrafo redundante.
- Detalhes com abas cinza em formato de fichário, sem moldura verde; cabeçalhos internos cinza escuro e tipografia uniforme; participantes e documentos em cinza claro com campos brancos.
- Aba Ficha e cabeçalho Ficha cadastral. Título e protocolo dentro da ficha, sem caixa adicional de identificação. Etapa como texto legível, sem badge.
- Removidos avisos redundantes de salvamento da avaliação e quadro separado de regras dos documentos. Cada documento identifica seus signatários.
- Repositório sem aviso operacional redundante nem caixa exclusiva de botão. Salvar no acervo no cabeçalho para Master; autores concluem o formulário com Concluir entrega final.
- Normalização de espaços, capitalização de nomes e instituições, e-mails em minúsculas no navegador e servidor; validação de campo no desfoque e antes de avançar. Matrícula conserva zeros e não é apresentada em caixa alta.
- Data e hora separadas no cadastro, opções de local empilhadas e rotuladas Primeira opção / Segunda opção. Erro de domínio institucional no singular.
- Removida a exigência de aceite separado da dupla para processos existentes e novos, preservando dados e auditoria histórica. Um autor cadastra/confirma o local. O PDF da resposta do departamento é obrigatório antes de qualquer avanço; erro sem PDF não muda revisão nem estado. A tela preserva os campos após falha.
- Solicitação de reserva com assunto completo, data brasileira e horário de Brasília. Departamento como destinatário; autores e orientador em Cc, deduplicados, sem injeção de cabeçalhos. Cópias persistidas no histórico para manter a mesma mensagem em tentativas; envio aceito não é repetido.
- Como usar e Fluxo com manual ilustrado por tarefa/perfil, instruções de acesso, reserva, comprovante, Ata, assinaturas, entrega e recuperação de erros. Imagens apenas de dados fictícios.
- Replicar Portal inclui GitHub e guia público para IA com arquitetura, ferramentas, projetos independentes, controles de acesso e sequência de implantação.

## OAuth Google

O aviso recebido trata de clientes agênticos e dos servidores MCP. O portal convencional usa APIs REST via OAuth, não MCP nem um agente autônomo operando Workspace. Não foram alteradas credenciais, escopos ou classificação. Detalhes e fontes em GOOGLE_OAUTH_MCP_2026-10-19.md.

## Validação

- test:ci: 583 testes e 17 contratos aprovados, TypeScript, segredos, acessibilidade estática, build e smoke HTTP.
- test:secure-flow: 40 aprovados, incluindo recusa de confirmação sem PDF e preservação da revisão/estado.
- Testes específicos de normalização, horário UTC/Brasília, Cc e não repetição de mensagens aceitas.
- Banco oficial original consultado: 37 processos na revisão 184 antes da publicação. Não houve importação de base local.

Não foram enviadas solicitações de reserva de teste nem praticadas assinaturas pessoais em produção. O teste de geração de documentos usa cópias temporárias e não altera os modelos originais. O último teste de integração e a implantação final são registrados abaixo após a publicação.

## Configuração oficial e pré-publicação

- Assunto do modelo `email-reserva` atualizado também no banco, com backup 6 anterior à mudança, auditoria e commit transacional. Revisão 188 após a alteração; 37 processos preservados.
- OAuth institucional conferido no Console Google: Em produção. Permanece o aviso Google de verificação do aplicativo, sem alteração de classificação ou escopos.
- Preflight Vercel final: nove verificações aprovadas (banco, Google, quatro modelos e três verificações Asten). Os modelos foram exportados com dados fictícios e sem marcadores pendentes, com limpeza das cópias temporárias.
- Fonte do artefato conferida por SHA-256 em 347 arquivos de execução e recursos públicos.

## Publicação concluída

- Implantação Ready: `dpl_Gpbv4BEyD2jduWaVPdzcgh91MqwC`.
- URL do artefato: https://portal-tcc-enfermagem-ufes-fq1i25xf6-tcc-enfermagem.vercel.app
- Promovida com sucesso para https://portal-tcc-enfermagem-ufes.vercel.app/
- Navegador oficial: asset `/assets/index-B3TM6G0m.js` coincide com o build; manual ilustrado de Como usar e Fluxo carregado; imagem do comprovante 1280×720 carregada; GitHub e guia para IA disponíveis; login sem parágrafo repetido; nenhum erro ou aviso capturado no console.
- Evidência visual: `output/revisao-2026-10-20/manual-oficial.jpg`.
- Local: árvore de campos e confirmação sem comprovante verificadas, mantendo o aviso instrutivo. Imagens publicadas são de processos fictícios com e-mails example.invalid.
- Não houve push/merge no GitHub. Checkout, alterações locais e `.env.local` preservados. O identificador acima identifica o artefato efetivamente online, independentemente do commit-base e da versão numérica no rodapé.
