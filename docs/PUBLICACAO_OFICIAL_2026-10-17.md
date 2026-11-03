# Portal TCC: publicação oficial de 17/10/2026

Destino: https://portal-tcc-enfermagem-ufes.vercel.app

## Dados e configuração

- Projeto Vercel: `portal-tcc-enfermagem-ufes`.
- Supabase original: `vvgdmycmotazqjvpywmk`. Os 36 processos existentes foram preservados; não foi importada a base demonstrativa local nem a base de homologação.
- Presidência: Prof.ª Drª. Márcia Valéria de Souza Almeida, `marcia.v.almeida@ufes.br`, conforme confirmação explícita do usuário. Cadastro inicial auditado, com backup anterior e commit transacional; o login continua exigindo código para o titular do e-mail.
- Reserva de sala: `tccenfermagemufes@gmail.com`, destinatário preexistente confirmado pelo usuário.
- Estúdio canônico com sete estágios, quatro modelos de documento, quatro modelos de e-mail e quatro definições nativas de formulário, vinculados aos modelos do banco original. Não havia Estúdio publicado nessa instalação; as configurações visíveis no navegador local não equivaliam a uma publicação no banco.
- Backups explícitos do agregado foram gravados antes das alterações de configuração.

## Implementação

- Identificação do TCC em uma linha; barra de navegação verde e cabeçalhos internos sálvia.
- Edição da ficha ao clicar nos dados; edição da banca ao clicar na linha, mantendo os campos em tabela.
- A confirmação do local da defesa foi colocada na ficha para o aluno/administrador. A retirada da aba Formulários não elimina essa ação necessária ao convite.
- Parecer padrão em texto corrido para a Ata, respeitando o resultado escolhido e sujeito à confirmação do professor.
- Quatro posições documentais visíveis, incluindo Termo; ele permanece indisponível quando não há pedido de publicação.
- Download circular abre seleção dos documentos disponíveis. O ZIP respeita os tipos selecionados e mantém os controles administrativos do dossiê.
- Escolha Asten/Gov.br na conclusão da Ata e dos dados de publicação do Termo. A escolha determina a geração automática, evitando iniciar dois provedores para a mesma versão. A Declaração aguarda a escolha da Presidência nos controles do próprio documento; a liberação da publicação não abre um envelope Asten antes dessa decisão.
- Gov.br admite Ata, Termo e Declaração. Signatários autorizados podem preparar e devolver o PDF. A aprovação continua administrativa e exige conferência manual no VALIDAR/ITI, de todas as assinaturas e do hash atual; upload sozinho não arquiva nem aprova.
- Resumo com oito linhas, orientação de aproximadamente 120 palavras e até dois parágrafos. A validação do servidor foi alinhada a esse formato.
- Cada arquivo do repositório contém sua própria opção de publicação. Marcação verde e autorização explícita mantidas.
- Corrigida a resolução do destinatário da reserva, que continha escape duplicado na expressão regular.

## Verificações

- `npm run test:ci`: 579 testes, 17 contratos de provedores, TypeScript, segredos, acessibilidade estática, finalização, build e smoke HTTP aprovados.
- `npm run test:secure-flow`: 40 verificações aprovadas.
- Verificações adicionais dos contratos visuais após o ajuste sálvia aprovadas; `git diff --check` sem erros.
- Vercel: persistência transacional no banco original, renovação Google, pasta privada e integridade dos quatro modelos confirmadas.
- Os quatro modelos oficiais foram mesclados com dados fictícios, exportados como PDF, conferidos quanto à substituição das variáveis e sem marcadores restantes. Cópias temporárias foram limpas. Os originais foram preservados.
- Conexão Asten, três pastas de destino e fila de retorno confirmadas. Perfil de assinatura `EMAIL_LINK` e liberação de produção configurados.
- Migração incremental da fila `portal_asten_webhook_inbox` aplicada ao banco original. RLS e revogação de acesso público verificadas. O aviso informativo de RLS sem política é intencional nessa tabela: apenas o backend usa `service_role`; não se deve conceder acesso a `anon`/`authenticated` para eliminar o aviso. Referência: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy
- Navegador local: edição por texto/linha, pop-up de download sobre o modal do TCC, quatro documentos, resumo de oito linhas, publicação na mesma caixa do arquivo e confirmação do local na ficha conferidos sem submeter processos de teste.

## Limites da conferência

Não foi praticada assinatura pessoal, aprovação acadêmica ou publicação de trabalhos reais em nome dos usuários. A aprovação Gov.br continua humana no VALIDAR/ITI. O fluxo real de login, recebimento de convites e assinatura pelos titulares deve ser exercitado pelo usuário na versão oficial.

A publicação foi preparada a partir do checkout local preservado, sem push ou merge no GitHub. O identificador de implantação e o manifesto privado de hashes distinguem esse artefato do commit-base e da versão numérica do rodapé.

## Artefato publicado

- Implantação final: `dpl_DJPG968T4FHsFb7rA5Wkw8TLGMnx`, status Ready, promovida com sucesso ao endereço oficial.
- URL imutável: https://portal-tcc-enfermagem-ufes-qavix1g9x-tcc-enfermagem.vercel.app
- Os 216 arquivos do manifesto de runtime foram comparados por SHA-256 entre o checkout e a fonte de publicação.
- Última rodada: 579 testes, 17 contratos e 40 verificações de fluxo seguro aprovados, incluindo ausência de envio de declaração antes da escolha da Presidência.
- Preflight da implantação final: nove verificações de banco, Google, quatro modelos e Asten aprovadas; configuração com sete estágios e ambos os e-mails confirmada.
- Endereço oficial recarregado no navegador após a promoção: calendário e dados institucionais carregaram; console sem erros ou avisos capturados. Evidência: `output/revisao-2026-10-17/portal-oficial-publicado.png`.
