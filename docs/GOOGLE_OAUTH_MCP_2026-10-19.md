# Aviso Google OAuth e MCP, 19/10/2026

O comunicado recebido em 19/10 informa a classificação `is_agentic` de clientes OAuth e o requisito de cliente agêntico para os servidores MCP do Google Workspace a partir de 11/11/2026. A classificação dos clientes existentes se torna permanente em 12/11, conforme o comunicado.

## Impacto nesta instalação

O backend do Portal usa OAuth 2.0 e refresh token para APIs REST: Gmail (`gmail.googleapis.com/gmail/v1`), Drive (`www.googleapis.com/drive/v3`), Docs e Calendar. Não conecta o cliente OAuth institucional aos servidores MCP nem entrega ferramentas de Workspace a um agente autônomo. O uso de IA para desenvolver o código não transforma o aplicativo publicado em agente de IA.

Não é necessário marcar o cliente OAuth atual como agêntico ou ampliar os escopos por causa deste aviso. Não foram alterados credenciais, consentimento, escopos ou classificação no Google Cloud. A renovação do token e a geração documental são verificadas separadamente na publicação.

Se no futuro um agente chamar Workspace por MCP (ou executar ações de agente via REST), crie um cliente OAuth separado para esse agente. Classifique apenas esse cliente e mantenha separados tráfego, escopos, callback e consentimento do portal acadêmico. Não compartilhe refresh tokens do portal com assistentes externos.

## Fontes

- Comunicado PDF fornecido pelo responsável, recebido em 19/10/2026.
- https://support.google.com/cloud/answer/15549257
- https://developers.google.com/workspace/guides/configure-mcp-servers

A configuração OAuth não substitui consentimento nem verificação do aplicativo quando exigida. Não há razão para reconectar a conta ou pedir novos acessos apenas para satisfazer o aviso MCP.

## Conferência adicional de 20/10/2026

O console do projeto institucional foi consultado sem alterações: Público-alvo mostra “Em produção”, tipo externo e uma autorização OAuth de 100 disponíveis. O Google ainda apresenta aviso de verificação do aplicativo. Isso deve ser acompanhado pelo proprietário se for ampliar as contas que autorizam a integração. O portal usa a conta institucional para Drive/Gmail; os alunos acessam por OTP do próprio portal e não concedem OAuth Google individualmente. A marcação `is_agentic` e a verificação do aplicativo são questões distintas.
