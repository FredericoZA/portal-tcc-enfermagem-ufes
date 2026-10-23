# Conferência e entrega — 22/10/2026

Esta conferência reúne os pedidos da conversa e respeita as decisões mais recentes,
inclusive restaurar o modelo original da ata e manter o cadastro de múltiplos
formulários. A base Git continua em `0e392dd`; as alterações locais foram
preservadas e a publicação usa uma cópia conferida por hash, sem copiar segredos
de produção para o Mac. Publicar na Vercel não atualiza a branch do GitHub.

| Área | Resultado conferido |
| --- | --- |
| Abas do processo | Dados do processo, Avaliação e ata, Documentos do processo e Repositório; abertura acompanha a etapa e mantém a ordem. |
| Dados do processo | Duas caixas, dados do processo e dos membros; edição no campo, gravação ao sair e sem botões de confirmação por campo. |
| Agendamento | Data, horário e local continuam editáveis com aviso vermelho, efeito no calendário, necessidade de informar o departamento e registro histórico. |
| Membros | Nome, e-mail, número de registro (matrícula, SIAPE ou outros), instituição; UFES para discentes. |
| Cabeçalho | Ícones para link e histórico; cópia informa por mensagem cinza, sem abrir diálogo. |
| Avaliação | Resultado e assinatura na mesma linha; texto padrão discreto e botão verde para visualizar ata. |
| Ata | Modelo original restaurado no Drive como versão 3. Não foi mantido o redesenho rejeitado. Editor integral e controles de confirmação preservados. |
| Prévia de documentos | Ícone no cabeçalho, fechamento externo; PDF aparece acima do detalhe do processo e usa o arquivo real quando disponível. |
| Cartões documentais | Títulos e áreas de assinatura alinhados; observação amarela explica a disponibilidade; Ver sálvia e baixar verde quando disponíveis, ambos desabilitados caso contrário. |
| Carta-convite | Sem assinatura e sem pasta de assinados. |
| Repositório | Resumo de até 2.000 caracteres, campos branco-gelo, margens reduzidas, cinco palavras-chave, uploads lado a lado e botão central de salvar/finalizar. A conclusão ainda exige os requisitos reais do processo. |
| Formulários | Criação, exclusão e campos personalizados mantidos; três formulários nativos sem uso retirados. Um campo de imagem e ícone no cabeçalho. |
| Imagens | PNG/JPEG/WebP até 10 MB, otimização e gravação dedicada no servidor. Pendência em outro formulário não impede a imagem. Revisão concorrente, autorização e autenticação recente continuam obrigatórias. |
| E-mails | Orientações por participante e links específicos do TCC; imagem salva também é lida pelo envio, usando URL absoluta do asset. Nenhum e-mail real foi disparado para testar. |
| Como usar | Orientações de onde clicar organizadas por papel, na seção própria. |
| Visual | Rótulos e botões em escrita normal, fundos cinza e branco-gelo, respeitando as cores solicitadas. |
| Drive | Raiz com Sistema, Documentos e Processos; sem separação por ano, lixo próprio ou repositório público duplicado. Destinos passam a ser criados sob demanda. |
| Limpeza do Drive | Duas pastas de piloto e quatro PDFs de piloto movidos para homologação existente, com IDs preservados; sete pastas legadas vazias removidas após nova leitura de conteúdo e pai. |
| Dados | Um processo oficial mantido. Removidos os 36 processos artificiais e 68 usuários de homologação da produção na rodada anterior, com recuperação privada; 400 processos demonstrativos removidos localmente. |
| Configuração antiga | Metadados visuais ausentes complementados, com versão anterior e auditoria; validador de endereço de e-mail e contraste corrigidos. |

## Evidências e limites

- 619 testes unitários, 17 contratos, TypeScript, acessibilidade estática,
  finalização, build e smoke HTTP aprovados.
- 40 verificações do fluxo seguro aprovadas. As cores das duas fixtures e do
  roteiro seguro foram ajustadas para texto escuro sobre branco, sem reduzir a
  exigência de contraste.
- Auditoria de dependências: zero vulnerabilidades conhecidas no momento da
  verificação; Vite 6.4.5.
- Navegador isolado: upload e permanência da imagem após recarregar confirmados.
  O ambiente isolado foi encerrado e seus dados removidos; a configuração local
  principal e a lista vazia de processos permaneceram preservadas.
- Conferidos os pais e as permissões dos modelos ativos, da carta gerada e dos
  dois formulários arquivados do TCC oficial. Sem compartilhamento `anyone` nos
  itens consultados.
- As duas falhas de capacidade do transporte temporário identificadas na revisão
  anterior receberam limites atômicos no banco e código, com testes de negação.
- A revisão de segurança teve cobertura parcial de código; não constitui uma
  certificação exaustiva dos 595 arquivos nem garante ausência de vulnerabilidades.
- Conexão e preparação de Asten podem ser verificadas sem disparar envelopes.
  Uma nova assinatura humana completa e o recebimento de e-mail em caixa real
  não foram realizados nesta conferência.

## Publicação confirmada

- Domínio oficial: https://portal-tcc-enfermagem-ufes.vercel.app/
- Versão imutável: https://portal-tcc-enfermagem-ufes-4xzmcn14k-tcc-enfermagem.vercel.app/
- Deployment `dpl_83TuERKDRELcqJP1AkYyTv8rHsuH`, projeto
  `prj_Au1sh3Ukf9vlLqBtGnDpsoiS1GtZ`, equipe `tcc-enfermagem`.
- Vercel retornou READY; promoção concluída e alias oficial lido novamente.
- 423 arquivos conferidos entre origem e cópia de publicação, sem divergência.
  SHA-256 do manifesto de fontes:
  `8c767523f6eb700d08b365fb76144ae133ed4ac181c938a11e5682058899245e`.
- Onze verificações na nuvem aprovadas: banco original, armazenamento da imagem
  com leitura e remoção apenas do asset técnico criado, dados de amostra válidos,
  Drive, quatro modelos/PDFs, conexão Asten, destinos Asten e fila de callbacks.
- O processo oficial foi comparado por igualdade JSON com a recuperação anterior:
  inalterado. Base com um processo, sete entregas de e-mail e zero jobs de assinatura,
  sem aumento por testes.
- Navegador no domínio oficial: calendário e único processo visíveis, imagens
  carregadas e consulta de console sem erros ou avisos nessa carga.

As evidências privadas de execução ficam em `.portal-data/review-release44/`.
Uma preparação intermediária foi bloqueada por timeout do Google ao conferir a
ata; o gate foi mantido e a versão final só foi promovida após os onze resultados
positivos. Nenhuma configuração de autenticação ou permissão foi relaxada.
