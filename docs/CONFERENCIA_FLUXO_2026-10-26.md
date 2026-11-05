# Conferência da revisão local — 26/10/2026

> Registro histórico. A regra antiga de assinatura exclusiva do orientador foi substituída: a ata exige orientador e dois examinadores. Não use este registro como roteiro vigente. Consulte [a diretriz atual](ASSINATURA_ATA_TRES_DOCENTES.md), o manual e `HOMOLOGACAO_ATUAL.md`.

## Escopo executado

- Fluxo do TCC, Como usar, manual ilustrado e resumo de assinaturas alinhados ao formulário direto do departamento.
- Como usar contém Aluno, Orientador e Visitante. A área operacional da presidência permanece.
- Guia para a IA baixado por Replicar Portal, README, Comece aqui e prompt de adaptação atualizados; referências RC antigas tratadas como históricas.
- Avisos por papel, um botão por mensagem, destino coerente com a atividade, sem anexos e com retorno à mesma aba após login.
- Ata exclusivamente pelo orientador; entrega após arquivamento; termo condicionado à publicação, assinatura simultânea na Asten e devolução Gov.br exclusivamente pelo orientador; declaração final pela presidência.
- Correção da leitura de ata arquivada quando outro provedor da mesma revisão ainda tem solicitação pendente. Proteção do carregamento inicial da ficha, validada no navegador.
- Imagens demonstrativas de reserva e documentos renovadas a partir de navegador local. Versões anteriores preservadas em `.portal-data/manual-antes-revisao-20261026/`.

## Evidências obtidas

| Verificação | Resultado | Registro |
|---|---|---|
| test:ci | 774 testes e 17 contratos aprovados; TypeScript, segredos, acessibilidade, finalização, build e HTTP aprovados | `.portal-data/flow-documentation-final-ci.log` |
| Fluxo seguro | 40 aprovados; nenhum falhou | `.portal-data/flow-documentation-secure.log` |
| Navegador — documentação | Três perfis, todas as atividades, imagens, navegação, mobile, guia baixável, reserva e documentos | `.portal-data/current-guide-browser.log` |
| Navegador — login por link | Login local por código, destino TCC/Documentos preservado; cancelar, recarregar, Geral e sessão expirada | `.portal-data/flow-documentation-email-login.log` |
| Galeria | Nove e-mails e uma variante do comprovante; um botão, imagens carregadas, sem variáveis pendentes | `.portal-data/flow-documentation-final-gallery.log` |

Os testes HTTP e de segurança usam bases temporárias e provedores simulados. Os testes do navegador não criaram TCCs nem enviaram mensagens reais. Nenhum processo oficial foi excluído. A fixture de navegação não representa homologação acadêmica de um processo completo real.

## Publicação e serviços reais

Não houve push, publicação no Vercel, alteração de dados ou configuração em produção, importação de modelos reais ou envio Gmail/Asten nesta rodada. O site publicado não recebeu estas mudanças. Uma validação em produção deve confirmar separadamente implantação, configuração publicada do Estúdio, modelos ativos, destinatários reais, envio do departamento, geração de PDF, assinatura e arquivamento.

As mudanças em textos e manuais não substituem documentos já assinados. Modelos/documentos e formulários foram cobertos pelos testes existentes; arquivos privados da instalação não foram sobrescritos para ilustrar o manual.
