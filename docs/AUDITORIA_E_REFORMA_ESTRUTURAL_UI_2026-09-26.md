# Portal TCC — Auditoria e reforma estrutural da interface

Data: 26/09/2026
Branch de trabalho: `refactor/global-ui-configuration-2026-09-26`
Base de produção no início da rodada: `56d918ad2fe499b1708b9286e4cb10e585f2a23e`

## Princípio da rodada

Esta rodada não deve ser tratada como uma coleção de correções cosméticas locais. O objetivo é eliminar fontes paralelas de estado, cor e layout, consolidando tokens semânticos, componentes compartilhados e regras de comportamento. Alterações que apenas escondam o problema com CSS específico de uma tela não satisfazem o requisito.

Status usados neste documento:
- `CORRIGIDO`: implementação concluída e verificada por teste/inspeção de código.
- `EM IMPLEMENTAÇÃO`: mudança em execução na branch, ainda sem validação final.
- `PENDENTE`: ainda não implementada.
- `NÃO CONFIRMADO`: pode já existir parcialmente, mas precisa de validação funcional/visual.

## Levantamento completo solicitado

| # | Área | Solicitação | Solução estrutural | Status |
|---|---|---|---|---|
| 1 | Design system | Evitar remendos e CSS isolado | Tokens semânticos + componentes compartilhados | EM IMPLEMENTAÇÃO |
| 2 | Design system | Superfícies: branco-gelo → cinza claro → cinza mais escuro → branco | `PORTAL_SURFACE_COLORS` e CSS vars globais | CORRIGIDO |
| 3 | Design system | Nada fluorescente | Paletas semânticas foscas centralizadas | CORRIGIDO |
| 4 | Tabelas | Texto comum sempre preto, sem desbotar por data/status | Contrato global de células; status só em indicadores | CORRIGIDO |
| 5 | Filtros | Aumentar somente a bolinha colorida em ~30% | Regra global do indicador sem alterar o botão | EM IMPLEMENTAÇÃO |
| 6 | Filtros/processos | Cor do filtro e do processo deve vir da mesma fonte | `resolvePortalFilterTone` + tokens semânticos | CORRIGIDO |
| 7 | Tabelas | Remover emojis do conteúdo tabular | Formatador global | CORRIGIDO |
| 8 | Cabeçalhos | Separador branco grosso de 16 px onde fecha o bloco superior | Token/regra estrutural compartilhada | CORRIGIDO |
| 9 | Colunas | Preferência de redimensionamento por usuário; Master define padrão global | Persistência global + override local | NÃO CONFIRMADO |
| 10 | Calendário | Sábado/domingo devem se fundir ao fundo da caixa; sem quadrado branco | Classe estrutural de fim de semana usando superfície do container | EM IMPLEMENTAÇÃO |
| 11 | Calendário | Evento deve mostrar 1ª linha: hora + título; 2ª: aluno(s) | Componente de resumo estruturado, não string curta | EM IMPLEMENTAÇÃO |
| 12 | Calendário | Mesma regra para eventos externos | Normalizador único para Google Calendar | EM IMPLEMENTAÇÃO |
| 13 | Calendário | A defender amarelo fosco; defendido verde fosco | `DefenseState` + tokens globais | CORRIGIDO |
| 14 | Lista de Defesas | Filtro, calendário e botão de processo com o mesmo estado/cor | `getDefenseState` como fonte única | CORRIGIDO |
| 15 | Lista de Defesas | Eliminar pílulas fluorescentes / status incorreto | Pílula semântica única | CORRIGIDO |
| 16 | Calendário | Navegação rápida sem race condition | Estado React único e descarte de resposta obsoleta | NÃO CONFIRMADO |
| 17 | Calendário | Clique no dia com defesa sem atraso/intermitência | Fluxo único de abertura; validar performance | NÃO CONFIRMADO |
| 18 | Meus TCCs | 4 papéis com 4 cores foscas distintas | Aluno/ Banca/ Avaliador/ Visualizador em tokens semânticos | CORRIGIDO |
| 19 | Meus TCCs | Botão do processo deve refletir o papel do filtro | Resolver papel → tone → filtro/pílula | CORRIGIDO |
| 20 | Meus TCCs | Texto preto normal | Contrato global de tabela | CORRIGIDO |
| 21 | Processos | Pílula canônica, simples e consistente | Componente/estilo semântico compartilhado | EM IMPLEMENTAÇÃO |
| 22 | Presidência | Pendente amarelo; assinado verde | Tokens `pending/signed` | CORRIGIDO |
| 23 | Presidência/Filtros | Bolinha de cor pouco visível | +30% no indicador global | EM IMPLEMENTAÇÃO |
| 24 | Presidência | Processo sem conteúdo redundante | Identificador canônico do processo | NÃO CONFIRMADO |
| 25 | Assinaturas | Tabela completa, compacta, scroll horizontal e ações fixas | Tabela ampla + sticky actions | CORRIGIDO |
| 26 | Assinaturas | Ter registro visual quando vazio sem contaminar base | Fixture somente de interface | CORRIGIDO |
| 27 | Assinaturas | Ações reais/contextuais | Detalhes/Reenviar/Reconciliar conforme backend | CORRIGIDO |
| 28 | Configurações | 6 entradas na ordem definida | Hub único ordenado | CORRIGIDO |
| 29 | Configurações | Todas as barras verdes com texto branco | Componente/classe compartilhada de título | EM IMPLEMENTAÇÃO |
| 30 | Configurações | Logs/Assinaturas fora da sidebar principal | Centralizar no hub de Configurações | NÃO CONFIRMADO |
| 31 | Configurações | Cada barra abre workspace/pop-up | Shell compartilhado | CORRIGIDO |
| 32 | Pop-ups | Paleta global e hierarquia consistente | `SettingsWorkspaceModal` + tokens de superfície | EM IMPLEMENTAÇÃO |
| 33 | Pop-ups simples | Sem sidebar/subtítulo repetido quando só existe uma planilha | Modo single-section automático | EM IMPLEMENTAÇÃO |
| 34 | Sincronização | Estrutura atual preservada | Manter duas áreas reais de navegação | CORRIGIDO |
| 35 | Sincronização | Trocar fundos verdes/azulados por superfícies globais | Tokens de superfície | EM IMPLEMENTAÇÃO |
| 36 | Sincronização | Tabela da comissão sem azul | Cabeçalho verde + corpo neutro | EM IMPLEMENTAÇÃO |
| 37 | Integrações | Revisar Asten/Google/Supabase/Vercel e paleta | Ações reais + estados sem inventar sucesso | EM IMPLEMENTAÇÃO |
| 38 | Acesso | Remover sidebar/repetição | Abrir direto na tabela | EM IMPLEMENTAÇÃO |
| 39 | Acesso | Planilha full-width com busca/filtros/ações | Shell single-section + tabela existente | EM IMPLEMENTAÇÃO |
| 40 | Modelos e Variáveis | Eliminar duas navegações concorrentes | Uma única navegação lateral | EM IMPLEMENTAÇÃO |
| 41 | Modelos e Variáveis | Sidebar: Modelos, Documentos, E-mails, Formulários, Fluxo, Variáveis | Navegação única no estúdio | EM IMPLEMENTAÇÃO |
| 42 | Modelos | Catálogo do Master vira seção própria | Integrar `MasterDocumentModelsPanel` na navegação | EM IMPLEMENTAÇÃO |
| 43 | Documentos | Prévia quebrada | Preview de saída usando dados simulados e pipeline do documento | EM IMPLEMENTAÇÃO |
| 44 | E-mails | Editor completo com variáveis, anexos, visual e fluxo | Consolidar recursos existentes e preview HTML fiel | EM IMPLEMENTAÇÃO |
| 45 | E-mails | Prévia muito fiel ao recebimento | Mesmo HTML/CSS usado na renderização do modelo | EM IMPLEMENTAÇÃO |
| 46 | Formulários | Evitar rolagem infinita de todos os campos abertos | Lista compacta + um campo selecionado por vez + preview | EM IMPLEMENTAÇÃO |
| 47 | Fluxo | Evitar todas as etapas expandidas | Visão compacta + uma etapa expandida por vez | EM IMPLEMENTAÇÃO |
| 48 | Variáveis | Remover sugestões inteligentes sem ação | Eliminar bloco de sugestões | EM IMPLEMENTAÇÃO |
| 49 | Variáveis | Descoberta/duplicação/mescla/limpeza em barra compacta | Toolbar de manutenção | EM IMPLEMENTAÇÃO |
| 50 | Variáveis | Cadastro canônico deve ser o núcleo da tela | Lista + definição + usos + formatação | CORRIGIDO |
| 51 | Variáveis | Formatação/definição propagada globalmente | `updateVariableAndPropagate` | CORRIGIDO |
| 52 | Variáveis | Detectar duplicatas e mesclar reescrevendo referências | Merge auditável com impacto | CORRIGIDO |
| 53 | Variáveis | Excluir apenas variável sem uso | Bloqueio por mapa de dependências | CORRIGIDO |
| 54 | Logs | Pop-up é só planilha; sem sidebar | Modo single-section | EM IMPLEMENTAÇÃO |
| 55 | Logs | Barra branca 16px | Cabeçalho estrutural | CORRIGIDO |
| 56 | Logs | Linhas/botões compactos | Densidade compacta | CORRIGIDO |
| 57 | Assinaturas | Pop-up é só planilha; sem sidebar | Modo single-section | EM IMPLEMENTAÇÃO |
| 58 | Personalização | Não alterar comportamento nesta rodada | Somente aparência; controles permanecem intactos | EM IMPLEMENTAÇÃO |
| 59 | Personalização | Tornar visual coerente com sistema sem disparar configuração | Camada estética isolada dos handlers | EM IMPLEMENTAÇÃO |
| 60 | Indicadores | Painel analítico rico e funcional | KPIs/tendências/funil/distribuições usando apenas dados reais | NÃO CONFIRMADO |
| 61 | Como Usar | Separador grosso e conteúdo detalhado por perfil | Contrato visual + conteúdo estruturado | NÃO CONFIRMADO |
| 62 | Fluxo do TCC | Cards detalhados/alinhados | Layout compartilhado | NÃO CONFIRMADO |
| 63 | Configurações | Registros de Assinatura antes de Registro de Logs | Ordem canônica do hub | CORRIGIDO |

## Critérios de aceite antes de publicar

1. `npm run lint` sem erros.
2. `npm run test:unit` sem falhas.
3. `npm run test:contracts` sem falhas.
4. `npm run test:a11y` sem falhas.
5. `npm run test:finalization` sem falhas.
6. `npm run build` concluído.
7. `npm run test:http` concluído.
8. Testes de contrato específicos da reforma estrutural.
9. Só integrar no `main` depois da suíte verde.
10. Após merge, verificar deploy da Vercel e smoke de produção antes de marcar `PUBLICADO`.

## Regra de segurança desta rodada

A área **Personalização do Portal** será apenas reformatada visualmente. Nenhum botão de personalização será acionado automaticamente e nenhuma lógica de persistência/configuração será alterada nesta rodada, porque o usuário relatou que alterações nessa área já quebraram a interface no passado.
