# Conferência local — 23/10/2026, rodada 54

A instrução vigente é executar os pedidos e manter a publicação no Vercel suspensa.
Esta rodada altera código local; não executa migrações de produção nem dispara
convites, códigos de acesso ou assinaturas reais.

## Ajustes executados

- Imagens de e-mails e formulários: concorrência por campo de imagem, revisão
  monotônica, rechecagem após o armazenamento e conciliação entre a base lida,
  o rascunho atual e a revisão do servidor. Alterações independentes são
  preservadas. Uma alteração concorrente no mesmo campo bloqueia a sobrescrita
  e conserva a imagem no rascunho do navegador. A imagem aguarda um salvamento
  já em andamento em vez de exigir uma nova seleção. Edições feitas durante o
  envio também são preservadas. O salvamento do pacote informa a revisão-base.
- Fluxos: a lixeira remove a linha da etapa, inclusive quando desmarcada; a
  seleção Usar continua apenas ativando/desativando a ação. Adicionar item
  recupera a linha. A remoção permanece após reabrir e não apaga o modelo
  compartilhado. As atualizações de compatibilidade respeitam remoções explícitas.
- Histórico do TCC: usa os eventos reais do servidor. Remove a reconstrução que
  atribuía eventos a pessoas e datas inferidas. A janela apresenta autor, papéis,
  data/hora e diferenças antes/depois; permite baixar PDF com todas as páginas.
  As APIs verificam o acesso ao processo e excluem segredos e conteúdo de arquivos.
- E-mails: a conferência dos dados pela orientação e as instruções da banca ficam
  no convite. A confirmação do local recebe orientação própria. O ID explícito
  do modelo tem precedência sobre um evento genérico de cadastro.
- Replicação: as quatro referências antigas de distribuição foram substituídas
  pelos modelos ativos conferidos no Drive. Convite/ata são baixados como DOCX;
  Termo/Declaração nativos são exportados para Word. O ZIP verifica a estrutura
  Word recebida. A mesma rota de download existe no servidor local e na Vercel.
  Nenhum original, documento preenchido ou arquivo assinado foi modificado.
- A leitura de modelos aceita referências canônicas do Drive/Docs ou IDs válidos,
  com codificação do ID nas URLs fixas do provedor; rejeita outros destinos.
- Parte pública: preservados os oito cartões unificados de replicação, o guia
  para IA, o texto à esquerda/imagem à direita no manual, as abas contíguas,
  os indicadores em cinza e a explicação de assinaturas centralizada no fluxo
  público. A explicação não aparece no editor de fluxos do Master.
- O mapa da página Como chegar deixou de ser bloqueado pela política do servidor:
  somente o domínio Google necessário ao iframe foi acrescentado, coerente com
  a configuração já existente na Vercel.

Os ajustes anteriores de decisão direta do Master, carregamento centralizado,
cartões documentais, cabeçalhos por tipo/código, ordem dos e-mails, entrega final,
assinaturas e instruções por perfil foram preservados.

## Verificação

- `npm run test:ci`: 662 testes unitários e 17 contratos aprovados, além de
  TypeScript, segredos, acessibilidade estática, finalização, build e smoke HTTP.
- `npm run test:secure-flow`: 40 verificações aprovadas.
- Conferência visual em base temporária e cliente compilado: 70 capturas, de
  320 a 1920 pixels e por perfil, sem erros reportados. Capturas de Replicar
  Portal e Como usar também foram abertas para inspeção visual.
- Navegador: exclusão 10 → 9 linhas, permanência após recarregar e recuperação
  via Adicionar item. Rascunho e armazenamento do navegador restaurados ao final.
- Navegador com API simulada: upload de e-mail e formulário com revisão mais
  nova; imagem, texto editado durante o envio e alteração independente preservados.
- HTTP isolado: imagens realmente persistidas nos dois tipos de editor, recusa
  de conflito no mesmo campo, controles 401/403 e recusa de pacote com revisão-base
  obsoleta. Nenhuma chamada a Gmail, Drive ou Asten nesse teste.
- HTTP isolado: alteração real de agendamento gerou registro durável com autor,
  antes/depois e data; JSON/PDF negados para usuário sem vínculo e sem misturar
  eventos de outro processo. PDF conserva eventos em múltiplas páginas.
- Modelos: os conteúdos ativos foram lidos pelo conector e contêm placeholders.
  Rotas de mídia/exportação e validação DOCX testadas com respostas simuladas.
  Isso não comprova o download usando as credenciais do runtime de produção.

## Limites da entrega

A revisão local não equivale a uma homologação externa de Gmail, Google,
Asten ou VALIDAR/ITI. Não houve envio real para esses serviços nem alteração
em processos oficiais. O build mantém o aviso conhecido de bundle grande.

O PR 166 permanece como revisão separada da branch principal. Alertas do CodeQL
precisam de análise própria antes de tratar os checks de segurança como aprovados;
esta rodada não os descarta nem os encerra automaticamente. Não houve merge
forçado nem alteração das regras de proteção.

**Nenhuma publicação no Vercel nesta rodada.**
