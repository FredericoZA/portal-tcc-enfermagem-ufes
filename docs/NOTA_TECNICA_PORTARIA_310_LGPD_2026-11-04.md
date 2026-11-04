# Nota técnica — Portaria Normativa GR/Ufes nº 310/2026 e LGPD

**Data de verificação:** 04/11/2026  
**Escopo:** Código do Portal TCC e consulta técnica de leitura à configuração de segurança do Supabase.  
**Finalidade:** Documentar os mecanismos efetivos e pontos de verificação antes da publicação de novas revisões. Não constitui homologação institucional, parecer jurídico ou certificação integral de conformidade.

## 1. Operação do Portal TCC

O Portal é uma aplicação administrativa de fluxo de TCC construída em React/TypeScript, com validações executadas em uma API e integração com Supabase, Google Workspace, Asten e Gov.br. Essas integrações executam funções de armazenamento, transporte, assinatura e controle de processos, não são utilizadas como modelos generativos na geração de pareceres ou indicadores.

A versão revisada contém **três modelos determinísticos** para o rascunho do parecer (Aprovado, Aprovado com ressalva, Reprovado). O texto é selecionado pelo resultado registrado, recebe somente o título do TCC e mantém campos de fundamentação que o orientador deve preencher. **Não interpreta o conteúdo do trabalho, não atribui conceito, não sugere fundamento acadêmico nem envia informações a um provedor de IA.** A revisão da ata e a validação dos dados são ações humanas.

O antigo motor de propostas automáticas e o analisador genérico de código com IA foram retirados da execução em uma revisão anterior. Os tipos residuais de estado histórico, quando existentes, servem apenas à preservação/compatibilidade de backups; não constituem uma integração ativa com modelos. Indicadores públicos e relatórios administrativos têm origem em cálculos estatísticos programados.

## 2. Medidas técnicas de minimização

- A API pública de indicadores não divulga e-mails, matrículas, nomes, títulos, resumos, palavras-chave de texto livre, locais informados livremente nem pareceres.
- Distribuições com baixa frequência são ocultadas. O conjunto com menos de cinco TCCs não exibe detalhes; cada categoria pública exige ao menos três ocorrências.
- O mês de pico e as estatísticas de tempo até a conclusão deixam de ser divulgados quando baseados em menos de três registros.
- Identificadores de status desconhecidos não são reproduzidos na resposta pública.
- A API administrativa de indicadores exige autenticação e papel de administrador; a autorização é verificada no servidor.
- O fluxo de documentos não deve simular assinatura ou disponibilidade de PDFs que não foram de fato emitidos.

**Limite:** a supressão estatística reduz risco, mas não garante anonimização absoluta diante de cruzamentos com outras fontes públicas. Revisar novas quebras de dados antes de ativá-las.

## 3. Inspeção do Supabase de produção

A leitura de metadados SQL em 04/11/2026 identificou:

| Controle | Resultado observado |
|---|---:|
| Tabelas no esquema `public` | 28 |
| Tabelas com RLS habilitada | 28 |
| Concessões diretas de leitura a `anon` | 0 |
| Concessões diretas de leitura a `authenticated` | 0 |

O verificador de segurança sinalizou **2 avisos informativos** de RLS habilitada sem políticas (`portal_asten_webhook_inbox` e `portal_feedback`). No desenho atual, essas tabelas permanecem inacessíveis diretamente aos papéis públicos; suas operações devem continuar mediadas pelo backend. Ausência de política não deve ser 'corrigida' com abertura indiscriminada de leitura.

Esses testes não verificam isoladamente o comportamento dos links de download, dos documentos Google, a rastreabilidade contratual ou a temporalidade de todos os registros.

## 4. Portaria nº 310/2026 — interpretação operacional

A portaria regula o **uso institucional de sistemas de IA** (arts. 1º, 2º e 8º). Ela não proíbe toda automação administrativa e não exige homologação de funcionalidades determinísticas apenas por utilizarem programação. Caso uma função de IA institucional seja incorporada futuramente, seu enquadramento deverá ser avaliado antes do uso conforme a governança prevista pela Ufes.

A norma também disciplina proteção de dados (arts. 16, 17 e 25), verificação de conteúdo (art. 18), declaração do uso de IA quando aplicável (art. 19), proibição de avaliação acadêmica automatizada sem validação docente (art. 20, V) e decisões sensíveis com supervisão humana (art. 22).

**Não declarar homologação concedida, autorização irrestrita, ausência de tratamento de dados pessoais nem certificação LGPD sem evidência da instância responsável.**

## 5. Verificações administrativas que continuam necessárias

1. Confirmar, com a unidade responsável e o Encarregado, finalidade, base legal e temporalidade de cada categoria de dado, incluindo dados históricos.
2. Documentar papéis de controlador e operadores, contratos/termos com Supabase, Vercel, Google e Asten, suboperadores, localização e eventuais transferências internacionais.
3. Revisar a visibilidade dos documentos no Drive, consentimentos/autorizações de publicação, URLs de download e validade de compartilhamentos.
4. Executar ensaio de restauração, rotação de segredos, resposta a incidentes e teste por papel (aluno, orientador, examinador e administrador).
5. Avaliar a necessidade de relatório de impacto à proteção de dados e os canais institucionais de exercício dos direitos dos titulares.
6. Revalidar os controles após a integração com outras PRs e **antes da publicação na Vercel**.

## 6. Regressões e publicação

- Testar rascunhos para os três resultados, preenchimento obrigatório e rejeição de campos pendentes.
- Confirmar que alteração do parecer invalida a prévia anterior; revisão e confirmação humanas permanecem obrigatórias.
- Testar agregação de indicadores com grupos pequenos, categorias não cadastradas e dados identificáveis inseridos como texto livre.
- Confirmar que links de legislação e guia continuam acessíveis em Informações Gerais e Documentos.
- Incorporar esta revisão somente após resolver conflitos com alterações simultâneas; publicar na Vercel apenas a versão integrada e validada.

**Referência:** Portaria Normativa GR/Ufes nº 310/2026, publicada em 27/10/2026; transcrição de consulta em `public/legislacao/PORTARIA_NORMATIVA_GR_UFES_310_2026.md`, com acesso ao índice institucional de atos normativos.
