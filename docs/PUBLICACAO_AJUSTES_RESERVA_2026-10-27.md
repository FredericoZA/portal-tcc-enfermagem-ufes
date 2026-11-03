# Publicação dos ajustes de reserva — 27/10/2026

Deployment de produção: `dpl_H6fQL6yLSm6RBmx6uSMNSbkAaC4z`.
URL fixa: https://portal-tcc-enfermagem-ufes.vercel.app/
URL da implantação: https://portal-tcc-enfermagem-ufes-3mawh9rwh-tcc-enfermagem.vercel.app/
Estado confirmado pelo provedor: READY, target production, alias público atribuído.

Inclui consulta prévia do orientador ao Departamento de Enfermagem, aviso amarelo antes dos dados do processo, logo transparente com variante PNG para e-mails, feedback de envio e bloqueio de repetição no formulário do departamento, e comprovante institucional de reserva/indisponibilidade. Fontes Noto Sans e licença OFL incluídas na função da API.

Verificações: 792 testes unitários, 17 contratos, TypeScript, acessibilidade estática, contrato de finalização, build e smoke HTTP aprovados; 40 verificações de fluxo seguro aprovadas. Manual e formulário percorridos no navegador local com dados temporários. Envio atrasado confirma feedback e prevenção de repetição; confirmação persistida após o envio. Capturas do manual renovadas.

Produção: publicação relida no provedor, instruções novas do Departamento de Enfermagem lidas em Como usar. Logo antigo acessado com format=png, imagem carregada, document.contentType=image/png. Navegação direta para arquivo JavaScript foi bloqueada pelo cliente do navegador, sem conclusão sobre a disponibilidade dessa rota por esse método. Sem pedido real de reserva, envio real de e-mail ou assinatura nesta publicação. A sessão administrativa não estava ativa para conferir os comprovantes privados em produção; as duas rotas foram verificadas no teste HTTP local.

Configuração local e dados de produção não foram sincronizados. Nenhum push Git foi realizado. O expurgo de envelopes Asten permanece uma frente separada ainda não homologada.
