# Relatório de validação — RC9

Versão: **1.0.0-rc.9**. Entrega: **10 de setembro de 2026**. Base: pacote RC8 recuperado, com integridade do ZIP conferida.

## Resultado

O código compila e as verificações executadas abaixo foram aprovadas. O formulário formal do orientador, a validação no servidor, as variáveis da nota, os diálogos do portal e a publicação da aparência compartilhada estão integrados.

Esta é uma entrega de código e documentação. Não foi realizada publicação nas contas institucionais nem um piloto com credenciais reais.

## Verificações executadas nesta rodada

| Verificação | Resultado |
|---|---|
| TypeScript, `npm run lint` | Aprovado, sem erros |
| Suíte `npm run test:unit` | **91 testes aprovados, 0 falhas**; inclui contratos dos provedores e o novo teste HTTP da avaliação |
| `npm run test:secure-flow` | **38 verificações aprovadas, 0 falhas** |
| `npm run test:a11y` | **120 arquivos verificados**, sem apontamentos pelo verificador estático |
| Compilação Vite + esbuild | Aprovada; cliente em `dist/client`, servidor em `dist/server` |
| `npm run test:http` | Saúde, SPA, cabeçalhos e separação cliente/servidor aprovados no servidor compilado |
| Dependências | Instaladas pelo lockfile existente; versões das dependências não foram atualizadas nesta rodada |
| Auditoria de vulnerabilidades atualizada | **Não confirmado** nesta rodada; a auditoria RC8 é histórica |
| Inspeção visual em navegador e dispositivos | **Não confirmado**; não foram feitas capturas nem aprovada linha de base visual nesta rodada |

Ambiente executado: Node.js **24.19.0**, npm **11.9.0**. O projeto declara Node.js **22.x** para implantação; a repetição dos testes em Node.js 22 permanece **não confirmada**.

## Novos casos cobertos

- Nota decimal aceita com ponto ou vírgula, incluindo zero, e preservação do valor numérico.
- Recusa de nota ausente, malformada, fora de 0–10 ou com mais de duas casas decimais.
- Recusa de avaliação sem conferência explícita, com resultado não publicado ou com parecer inválido.
- Recusa de revisão desatualizada do processo ou do formulário e de defesa ainda não iniciada.
- Preservação da cópia dos dados conferidos, revisão, responsável, data e respostas adicionais.
- Variáveis da avaliação disponíveis para o DOCX; respostas livres não substituem nota e identidade canônicas.
- Configurações antigas de aparência normalizadas sem perder colunas, rótulos e textos.
- Teste HTTP real contra servidor local: aluno recusado, orientador autorizado, avaliação salva, duplicidade recusada e dados confirmados no arquivo local.
- Teste HTTP da aparência: publicação administrativa, padrão global devolvido à consulta pública e configuração confirmada no arquivo local.

No teste HTTP da avaliação, a ausência deliberada de Google autorizado produz HTTP 202: a nota fica salva e o arquivamento fica pendente. Isso confirma a comunicação da falha parcial; não comprova geração, envio nem assinatura em provedores reais.

## Limitações e próxima etapa

Google Docs/PDF, Gmail, Calendar, Drive real, assinatura Asten, callback público, Supabase remoto, cron e execução na Vercel permanecem **não confirmados**. Os contratos simulados verificam a lógica do programa; eles não comprovam acesso, configuração, disponibilidade ou entrega nas contas do proprietário.

A verificação estática de acessibilidade não comprova contraste final, responsividade, navegação por teclado, foco dos diálogos, zoom ou leitor de tela. Esses itens precisam do piloto em `HOMOLOGACAO_RC9.md`.

O ZIP contém fontes, migrações, testes, recursos visuais do sistema e instruções. Exclui dependências instaladas, compilação, estado local, logs, credenciais e DOCX oficiais pertencentes ao Master. O empacotador verifica CRC e estrutura mínima do arquivo. A documentação de entrada é `COMECE_AQUI.md`, seguida por `PROMPT_PARA_IA.md`.

## Referências técnicas consultadas

- React: https://react.dev/reference/react/useSyncExternalStore
- Supabase: https://supabase.com/changelog
- Proteção da API Supabase: https://supabase.com/docs/guides/api/securing-your-api

Nenhuma alteração de esquema ou de política RLS foi feita nesta rodada. O estado ampliado usa a persistência JSON e o runtime v6 já existentes.
