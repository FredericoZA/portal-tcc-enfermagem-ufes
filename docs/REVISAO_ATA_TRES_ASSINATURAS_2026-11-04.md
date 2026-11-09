# Revisão da ata com três assinaturas — 04/11/2026

## Resultado local

A base consolidada já continha a derivação de três docentes e a confirmação dos três signatários na Asten. Foram corrigidas referências restantes à assinatura exclusiva do orientador no e-mail de orientações, no simulador de Configurações e nos guias operacionais. Relatórios antigos receberam aviso de regra substituída, preservando os resultados históricos.

O Gov.br agora exige assinaturas digitais distintas em quantidade correspondente aos signatários esperados, tanto na devolução quanto antes da aprovação. Na ata, PDFs com uma ou duas assinaturas são recusados. Campos repetidos da mesma assinatura não contam novamente; assinaturas de revisões incrementais anteriores são consideradas. A verificação é estrutural e não substitui a confirmação administrativa de validade e identidade no VALIDAR/ITI.

Asten continua exigindo orientador e dois examinadores, todos na prioridade 1. O envio é explícito, por Documentos administrativos; registrar o conceito não dispara assinatura automaticamente. Solicitações pendentes antigas com somente um signatário não são reutilizadas. Atas históricas arquivadas permanecem preservadas.

## Verificação executada

- 1.026 testes automatizados aprovados, zero falhas na execução final.
- 17 contratos de provedores e 40 verificações de fluxo seguro aprovados.
- TypeScript, build, smoke HTTP, artefatos serverless e detecção de segredos aprovados.
- Navegador: 27 atividades dos quatro perfis, imagens, teclado e larguras 1440, 768 e 390 px, sem erro de JavaScript ou envio de formulários.
- Capturas adicionais do perfil Examinador e do quadro de assinaturas, conferidas visualmente.
- Manual em PDF: 17 páginas, capítulo do examinador e três assinaturas; bytes servidos pelo site local iguais ao arquivo público.
- Migração de configuração antiga testada, incluindo prioridade 1, retirada do aviso automático antigo e idempotência.
- Payload Asten testado com os três destinatários e nomes completos; banca incompleta, e-mail repetido, solicitação antiga e assinatura pendente bloqueados.

## Entrega e limites

Instância local compilada: http://127.0.0.1:3001/ . Dados isolados; nenhum e-mail real, envelope Asten ou PDF Gov.br real foi enviado. Não houve push, merge, publicação Vercel ou alteração em produção. A homologação operacional requer uma assinatura real dos três docentes, recebimento dos links e arquivamento no Drive após a futura publicação autorizada.

O build mantém o aviso preexistente de alguns pacotes JavaScript acima de 500 kB; a compilação concluiu normalmente. Não se trata de falha nas assinaturas.
