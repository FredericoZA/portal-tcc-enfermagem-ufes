# Revisão local de Como usar e Fluxo do TCC — 26/10/2026

Esta revisão acompanha as regras implementadas de reserva, assinaturas e consulta pública. Não publica alterações no Vercel nem modifica dados de produção.

## Conteúdo alinhado

- Consulta prévia à secretaria com o orientador antes do cadastro; solicitação e homologação são momentos diferentes.
- Ordem dos nomes conforme Aluno 1 e Aluno 2; seleção de referência aos autores, tratamento e titulação docente, preservando o nome social informado.
- Departamento confirma ou nega pelo formulário recebido por e-mail; comprovante automático, sem upload de resposta pelo aluno.
- Defesa de 90 minutos; reservas no mesmo local não podem se sobrepor. Alterações permitidas antes do convite invalidam a confirmação anterior e exigem nova homologação.
- Convite aos dois membros convidados, com autores e orientador em cópia; carta consultada no Portal.
- Ata assinada apenas pelo orientador; entrega no Repositório somente depois de seu arquivamento.
- Qualquer autor pode entregar o PDF final, o resumo e cinco palavras-chave; resumo expandido opcional e escolhas de publicação independentes.
- Termo apenas quando houver publicação autorizada, assinado por todos os autores e orientador. Pelo Gov.br, somente o orientador devolve o mesmo PDF com todas as assinaturas.
- Presidência da comissão assina a declaração; essa função difere da presidência da sessão pelo orientador. O manual mantém apenas Aluno, Orientador e Visitante.
- Depois de assinado e arquivado, o documento permite consulta e download, sem novo pedido de assinatura.
- Visitante pode fechar o login e consultar a ficha pública. Trabalho e resumo expandido dependem de autorização; dados de contato e registros permanecem restritos.

## Verificação

O teste `scripts/test-current-guide-browser.ts` percorre as atividades dos três perfis, verifica imagens, ordem de acesso, instruções de assinatura, consulta pública e largura de celular. Usa servidor e dados temporários, bloqueia chamadas externas e não cria TCCs nem envia e-mails reais.

As capturas de cadastro, reserva, documentos e repositório são renovadas com `PORTAL_REFRESH_GUIDE_IMAGES=true`. São ilustrações com dados fictícios; não comprovam integrações reais.

Os resultados desta execução ficam em `.portal-data/public-guides-*.log`. A implementação de exclusão completa é uma frente separada; o contrato de expurgo Asten continua pendente de consulta autenticada.

## Publicação autorizada posteriormente

O pedido posterior autorizou publicar esta revisão junto com a correção do cadastro e os avisos mais curtos. Deployment de produção: `dpl_EiYJpUF3wRGzLQc5QqBG6jFT1Esb`, confirmado READY e associado a `portal-tcc-enfermagem-ufes.vercel.app`.

Validação: 788 testes unitários, 17 contratos, 40 verificações de fluxo seguro, build e smoke HTTP aprovados. Manual dos três perfis e imagens verificados no navegador local. Cadastro em produção aberto e textos reduzidos lidos com a sessão Master ativa, sem enviar cadastro nem e-mails de teste.

A migração `complete_process_cleanup` foi aplicada no Supabase e relida: atualização de backups com filtro, vínculo de downloads por processo e RPC de expurgo restrita ao serviço. O expurgo Asten continua pendente; não foi homologado nem declarado concluído.
