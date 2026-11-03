# Portal local para testes — 23/10/2026

Abra http://localhost:3000. O atalho **Iniciar Portal TCC.command** continua válido.
A barra **Simular como** tem Master, Presidência, Orientador e os usuários
**Teste 01** a **Teste 12**. Selecione o aluno do cenário antes de abrir seu link.
Os registros são fictícios, identificados no título. Nada foi publicado no Vercel.

## Cenários preparados

| Perfil de aluno | Cenário | Link |
|---|---|---|
| Teste 01 | Reserva sem comprovante; título editável | http://localhost:3000/?tcc=qa58-01&secao=geral |
| Teste 02 | Comprovante anexado, aguardando confirmação | http://localhost:3000/?tcc=qa58-02&secao=geral |
| Teste 03 | Convite disponível para visualizar/baixar | http://localhost:3000/?tcc=qa58-03&secao=docs |
| Teste 04 | Avaliação pendente; testar também como orientador | http://localhost:3000/?tcc=qa58-04&secao=avaliacao |
| Teste 05 | Ata aguardando assinatura | http://localhost:3000/?tcc=qa58-05&secao=docs |
| Teste 06 | Entrega sem arquivos finais | http://localhost:3000/?tcc=qa58-06&secao=acervo |
| Teste 07 | Trabalho anexado, resumo expandido ausente | http://localhost:3000/?tcc=qa58-07&secao=acervo |
| Teste 08 | Trabalho e resumo anexados | http://localhost:3000/?tcc=qa58-08&secao=acervo |
| Teste 09 | Opção de publicar somente o resumo expandido | http://localhost:3000/?tcc=qa58-09&secao=acervo |
| Teste 10 | Entrega registrada sem autorização de publicação | http://localhost:3000/?tcc=qa58-10&secao=docs |
| Teste 11 | Publicação solicitada, termo pendente | http://localhost:3000/?tcc=qa58-11&secao=docs |
| Teste 12 | Entrega sem publicação, declaração pendente | http://localhost:3000/?tcc=qa58-12&secao=docs |

Os e-mails de aluno seguem `teste.qa58.01@edu.ufes.br` até
`teste.qa58.12@edu.ufes.br`. Esses endereços são identidades fictícias reservadas
para este pacote local; não são contas criadas nem destinatários de envios reais.
O orientador dos cenários é o perfil já disponível na barra: `ana.santos@ufes.br`.

A massa inclui ainda centenas de registros `visual-demo-*` para tabelas e
indicadores. Os 13 exemplos anteriores e as configurações foram preservados.
O teste de exclusão removeu apenas `visual-demo-tcc-0001`. O total ao encerrar
esse teste é 411 TCCs. Todos os cenários novos têm defesa em dia útil.

## O que foi conferido

- Pedido de reserva: departamento responde disponibilidade; autores salvam a
  confirmação em PDF, anexam e registram; orientação aguarda. Convite e próximas
  instruções vêm na comunicação seguinte. Sem instruções prematuras para banca.
- Etapas de avaliação/ata, entrega final, autorização e declaração têm instruções
  distintas. O código do TCC aparece no botão em vez da URL longa.
- Edição do título por aluno: salvamento automático, leitura após recarregar,
  registro do usuário, horário e valores anterior/novo na auditoria.
- Relatório do histórico baixado em PDF pelo botão do relógio.
- Upload pela interface e recuperação dos PDFs; teste HTTP de substituição por
  versão 2, idempotência, checksum, permissões e auditoria.
- Convite exibido em canvas e baixado pela janela de visualização com autenticação.
- Exclusão de um registro fictício sem documentos institucionais, pela interface.
  Processos com documentos/assinaturas continuam protegidos contra exclusão.
- Suítes de autosave, imagens, modelos, identidade administrativa, fluxo seguro e
  contratos verificadas automaticamente; evidências privadas em `.portal-data/review58/`.

## Limites do ambiente

Os PDFs são de demonstração, sem validade acadêmica. Estados de assinatura
concluída nos cenários são simulações, não assinaturas reais. Não há envelope
Asten, envio Gmail, autorização de Drive ou publicação pública nesse pacote.
O armazenamento local de PDFs só é habilitado com desenvolvimento, `local_file`,
renderizador de testes, autenticação demonstrativa e opt-in da revisão local;
é recusado em produção/Vercel.

A conclusão real com geração automática, retorno da Asten/Gov.br e arquivamento
no Drive depende dos modelos, fluxos e integrações da instalação. As configurações
existentes não foram substituídas por credenciais nem por fluxos fictícios. Se uma
etapa indicar integração/configuração pendente, isso não deve ser interpretado
como uma assinatura concluída. O teste local não homologa esses provedores.

Não use **Restaurar Dados** durante a revisão: essa ação restaura os exemplos
originais e remove a massa preparada. Há backups locais em `.portal-data/backups/`.

Resultado final automatizado: 675 testes unitários, 17 contratos e 40 verificações
seguras aprovados. Após o ajuste de hidratação do catálogo, TypeScript, build e
quatro regressões de autosave passaram. A última bateria visual gerou 70 capturas,
sem erros registrados nem overflow, em quatro larguras e diferentes perfis.
