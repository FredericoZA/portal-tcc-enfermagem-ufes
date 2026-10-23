# Portal TCC — trabalho local

Este é o repositório local de desenvolvimento do Portal TCC. Preserve o trabalho
existente e consulte `DESENVOLVIMENTO_LOCAL.md`, `README.md` e `CONTRIBUTING.md`
antes de alterações. Não recomece o sistema do zero.

## Forma de trabalho

- O usuário acompanha o portal em http://localhost:3000 e solicita alterações
  pela tarefa do Codex ligada a esta pasta. Execute o trabalho diretamente quando
  o pedido estiver claro; não transfira comandos rotineiros para o usuário.
- Preserve mudanças ainda não commitadas. A branch de preparação local é
  `work/desenvolvimento-local`; confira o estado real antes de trabalhar.
- O atalho `Iniciar Portal TCC.command` inicia o servidor; `npm run dev` também
  funciona. Reutilize o servidor quando já estiver ativo. Não deixe servidores
  duplicados ou serviços permanentes desnecessários.
- Desenvolva e teste localmente. Não faça push, deploy, merge ou alterações em
  produção sem um pedido do usuário para essa publicação/operação.
- `.env.local` contém apenas configuração e segredos locais. Não exiba valores,
  não os envie ao GitHub e não substitua esse arquivo por credenciais de produção.
- O desenvolvimento usa `local_file` e dados demonstrativos em `.portal-data/`.
  Uma alteração de dados/configuração local não atualiza automaticamente o site
  publicado. Supabase real, Gmail, Drive e Asten exigem verificação separada.
- Teste o fluxo afetado no navegador e execute os checks adequados. Quando mudar
  autenticação ou permissões, valide também o fluxo seguro. Nunca afirme que uma
  integração real foi homologada usando apenas simulações locais.
- Faça alterações pequenas e reversíveis. Preserve recuperação antes de ações
  destrutivas; confirme o alvo e evite dados de outros projetos.
- Use português e explicações simples. Informe o que mudou, o que foi testado e
  qualquer resultado não confirmado.

## Segurança da ferramenta

O padrão configurado para novas tarefas é `workspace-write` com aprovação
`on-request`. Preserve esse limite: não transforme uma restrição em justificativa
para desativar o sandbox ou as proteções do Mac. Peça a autorização específica
quando uma operação necessária ultrapassar o escopo permitido.

Não altere as configurações globais do Codex para resolver um problema do portal
sem pedido específico do usuário. Não apague credenciais, ferramentas pessoais,
histórico ou arquivos de outros projetos.
