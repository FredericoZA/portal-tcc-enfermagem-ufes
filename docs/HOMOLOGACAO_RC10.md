# Piloto necessário antes do uso institucional — RC10

> **Documento histórico.** Este roteiro registra o estado da RC10 e não deve ser usado como instrução operacional atual. O fluxo vigente está em `docs/HOMOLOGACAO_ATUAL.md`. Em particular, a avaliação atual registra **resultado e parecer sem nota numérica** e o contrato público atual não expõe matrícula, e-mail, SIAPE ou identificadores internos.

Situação registrada naquela entrega: testes automatizados e compilação aprovados no Node.js 22.23.2. Integrações nas contas do proprietário e inspeção visual em navegador: **não confirmado**. O navegador de automação não estava disponível; as tentativas de instalação não concluíram. Use o ambiente de implantação para a inspeção visual.

Use projetos, documentos e destinatários de teste. Execute depois da instalação descrita em `IMPLANTACAO_PRODUCAO.md`.

| Verificação | Evidência registrada para a RC10 |
|---|---|
| Acesso | Master libera aluno; código funciona uma única vez; demais participantes recebem somente os acessos devidos |
| Cadastro | Rascunho recuperado, respostas adicionais preservadas e limite de um TCC por autor aplicado |
| Reserva | E-mail recebido no endereço correto do departamento, com data, horário e sala pedidos |
| Declaração do aluno | Sem declaração não sai convite; após declarar, responsável e data ficam registrados; nenhum login do departamento é exigido |
| Convite | PDF fiel ao DOCX, sem marcadores pendentes, com dados corretos e recebido por todos os destinatários configurados |
| Conferência | Orientador visualiza os dados corretos; aluno e banca não lançam avaliação; falta de confirmação e revisão antiga são bloqueadas |
| Apresentação | Avaliação bloqueada antes do horário; resultado e parecer são registrados pelo orientador |
| Ata | Somente orientador é signatário; callback recebido; PDF final corresponde ao envelope e está no Drive privado |
| Entrega final | Permanece bloqueada até Ata assinada e arquivada; trabalho completo é guardado mesmo sem publicação |
| Termo | Testar trabalho público, resumo público, ambos e nenhum; quando aplicável, todos os autores e orientador assinam em paralelo |
| Declaração | Espera os documentos anteriores aplicáveis; Presidente correto assina; documento final arquivado |
| Recuperação | Falha de Gmail, Google ou Asten aparece como pendência; retomada preserva ações concluídas e não duplica envelope incerto |
| Persistência | Reiniciar/reimplantar conserva dados, conferência, filas e aparência; teste também concorrência no Supabase real |
| Aparência | Publicar mudança e abrir outra sessão: tabelas e pop-ups herdam o padrão; colunas e textos são preservados |
| Navegação | Testar 320, 768, 1024 e 1440 px; teclado, zoom, leitura, foco dos diálogos e fechamento com Escape |
| Operação | Verificar limites do ambiente Vercel, cron autenticado, limpeza do staging e logs sem segredos |

O roteiro acima permanece somente para rastreabilidade histórica. Para qualquer homologação nova, use `docs/HOMOLOGACAO_ATUAL.md`.
