# Identidade dos documentos do Portal TCC

Os novos documentos da instalação UFES usam o brasão de armas nacional dos modelos institucionais existentes. O brasão da UFES permanece no cabeçalho superior do site. A logomarca COLENF não é usada nas telas operacionais nem nos novos documentos.

## Arquivos de referência no Drive

Em 15/11/2026, os arquivos de referência foram conferidos em **Portal de TCC → 03_SUPORTE** (pasta `1OOpik3Pb6af8VrRE4Uf1Qk9m2fdbCC4M`), após a reorganização feita pelo responsável pelo portal:

| Arquivo | ID no Drive |
| --- | --- |
| 00 - Padrão Visual e Formatação — Portal TCC.pdf | `1-2RR4hcZ0oMLqtL19i9mcCWdZf57wKGA` |
| Logomarca Colenf — fundo transparente.png | `15lrR5WB2uhrpGI_OGZbfoD5BuFeDg6BT` |
| Brasão da UFES — fundo transparente.png | `1o4TR-z0ljRRhxvev_8SKXCo5i4I2s1Ht` |

O portal não busca esses três arquivos pelo nome na raiz do Drive. O cabeçalho usa a cópia estática `public/ufes-crest.png`; a geração documental usa os recursos locais de `server/documents/assets/`. O PDF de padrão visual é uma referência de manutenção. A mudança de pasta no Drive não exige mudar esses caminhos locais nem acrescentar consultas ao Drive. Ao atualizar o conteúdo de uma imagem, é necessário atualizar e conferir também a cópia usada pelo portal.

As referências futuras ao Drive devem preservar os IDs dos arquivos acima, sem depender da posição na árvore de pastas. A pasta técnica privada configurada por `PORTAL_DRIVE_TECHNICAL_FOLDER_ID` e o fallback local `00_SISTEMA` têm outra finalidade e não devem ser substituídos por `03_SUPORTE`.

## Aplicação nos documentos

A imagem `national-arms.png` foi extraída, sem redesenho ou transformação, de `word/media/image1.png` do modelo original `CONVITE.docx` já disponibilizado pelo responsável pelo Portal. As cópias pública e de servidor são idênticas.

SHA-256: `fdd314c6cdf5cb3d1cb6f244077d3e9b3755262a7b2e76a3a17df71d00451e5b`.

Cabeçalho: brasão de armas; Universidade Federal do Espírito Santo; Centro de Ciências da Saúde; Curso de Graduação em Enfermagem e Obstetrícia.

Encerramento alinhado à direita: Comissão de Trabalho de Conclusão de Curso; Departamento de Enfermagem; Curso de Enfermagem e Obstetrícia — CCS/UFES. A data da carta-convite fica após Atenciosamente, no encerramento, também alinhada à direita. Autores e examinadores possuem uma linha de identificação por pessoa.

A unidade emissora não substitui as pessoas responsáveis por assinar. A ata continua exigindo orientador e dois examinadores. Os demais documentos conservam seus respectivos signatários.

Nos modelos Google Docs, a identificação é ajustada somente na cópia temporária, antes da mesclagem dos campos. Os modelos originais e os PDFs históricos assinados não são reescritos por essa transformação.

As datas de leitura incluem o dia da semana. Os campos técnicos de integrações, controle de versão, ordenação e armazenamento continuam usando suas representações originais. Datas de defesa seguem o fuso institucional de Vitória; registros de auditoria exibem o fuso configurado quando aplicável.
