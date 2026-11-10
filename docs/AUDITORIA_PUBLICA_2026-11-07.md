# Auditoria pública real — 7 de novembro de 2026

Consulta anônima do endereço oficial https://portal-tcc-enfermagem-ufes.vercel.app/, build 500bfb6, em uma aba nova do perfil Chrome existente Compilando o Conhecimento. Nenhum login, envio, arquivo, cadastro ou configuração foi alterado. A dimensão temporária de viewport foi restaurada e a aba criada foi fechada ao terminar.

## 031 — responsividade pública

Medições via CUA e DOM do conteúdo real, altura de viewport 1000px. As capturas visuais de Repositório, manual, fluxo e Indicadores foram exibidas no registro da execução CUA; não foram exportadas para arquivos.

| Página | 390 | 768 | 1024 | 1440 | 1920 |
|---|---:|---:|---:|---:|---:|
| Calendário: excedente da página/conteúdo (px) | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 |
| Como usar: excedente da página/conteúdo (px) | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 |
| Fluxo do TCC: excedente da página/conteúdo (px) | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 |
| Informações gerais: excedente da página/conteúdo (px) | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 |
| Como chegar: excedente da página/conteúdo (px) | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 |
| Indicadores: excedente da página/conteúdo (px) | 0/326 | 0/0 | 0/0 | 0/0 | 0/0 |
| Repositório: excedente da página (px) | 0 | 0 | 0 | 0 | 0 |
| Repositório: rolagem interna necessária da tabela (px) | 4778 | 4400 | 4400 | 3984 | 3504 |

No manual, foi conferida a atividade Conceito e Ata do perfil Orientador, tela 4/7: fonte de instruções 16px e imagem carregada nas cinco larguras. Em390/768 a imagem fica abaixo das instruções; em 1024/1440/1920 fica ao lado. O CTA permanece dentro da largura. Não se afirma revisão integral de cada perfil do manual nesta execução.

No fluxo público foram observadas 8etapas e orientação de assinatura automática ASTEN com links individuais. A grade usa 1coluna a 390,2 colunas a 768/1024 e4 colunas a 1440/1920.

Defeito comprovado: a 390, o cartão de tendência mensal de Indicadores media 654px (borda direita 691), enquanto o painel terminava em 366. O SVG e as legendas de largura mínima 620 expandiam o item da grade em vez de permitir rolagem só dentro do gráfico. A correção limita o tamanho mínimo do cartão com `min-w-0`, preserva o gráfico largo rolável e dá foco/descrição à região de rolagem. Ela não altera consulta, fórmula, permissões ou fluxo. **A medição desta tabela é anterior ao patch; a verificação visual da correção no oficial está pendente da publicação.**

Os atalhos de zoom tentados não modificaram innerWidth 1440, devicePixelRatio 1 ou visualViewport.scale 1. Portanto zoom 125%/200% permanece sem confirmação. Leitor de tela, todas as operações por teclado e telas autenticadas não foram homologados por esta auditoria. Os links de Informações gerais foram inventariados pelo href; sua navegação/destino não foi testada.

## 004 — mapa de instituições

Regra direta do usuário: a instituição do orientador deve aparecer por extenso. No repositório oficial, as 110células de orientador continham Universidade Federal do Espírito Santo, nas cinco larguras. Não foi alterado nenhum dado de instituição.

| Superfície | Fonte atual |
|---|---|
| Nome oficial | src/constants/installation.ts: institutionName/defaultInstitutionName |
| Repositório: orientador | src/pages/HomePage.tsx: installationProfile.institutionName |
| Consulta pública de processos novos | server/publicViews.ts: perfil oficial para orientador |
| Complemento institucional ausente | server/ufesFacultyInstitution.ts: catálogo exato nome+e-mail, preservando valor informado |
| Calendário, lista, Meus TCCs, Presidência | instituição informada/default, conforme vínculo e origem |
| Dados do processo e campos editáveis | src/pages/ProcessoDetailPage.tsx: instituição do participante/default |
| Entrada de instituição | src/utils/institutionName.ts: normalização de apresentação e delimitadores de siglas |
| Documentos | src/utils/documentTemplateEngine.ts: variáveis de modelo e instituição de banca informada |

Não se aplicou substituição geral de instituição nem abreviação por inferência. Recuperação e complementação dos registros históricos ficam adiadas por decisão do usuário; a evidência 110/110 cobre a apresentação do orientador no repositório, não certifica instituições dos demais membros nem completude histórica.

## Validação local do patch

22 testes existentes passaram em server/version1044PublicUxContract.test.ts, server/update40HomologationContract.test.ts, server/update38UiContract.test.ts e server/homologacaoVisual20260927Contract.test.ts. Revisão React: somente classes/semântica de região, sem hook novo, consulta nova ou dependência. Nenhum servidor, credencial ou fixture foi criado para esta auditoria.

## 006.06 — filtros limitados aos gráficos divulgados

Foram acrescentados dois controles locais, com o escopo no rótulo e explicação junto ao resultado: ano somente na série mensal e período informado somente nas barras de período acadêmico. As opções provêm dos buckets já divulgados pela API. Os controles não consultam dados novos nem alteram totais, medidas descritivas ou outras distribuições; não produzem contagens de categorias ocultas por subtração.

O recorte mensal mantém apenas os meses existentes do ano escolhido: lacunas continuam ausentes, sem preencher zero ou ligar meses não consecutivos. O recorte de período mantém a contagem original da categoria divulgada. Seleção inexistente após atualização volta à base divulgada completa. Os testes de função verificam identidade/contagens, lacunas e ausência de opções sintetizadas. Esta implementação não afirma filtragem global do painel nem validação visual publicada; a revisão no navegador deve ocorrer após a próxima release real.
