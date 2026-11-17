/** Display names may change without changing the stored document type or Drive ID. */
export const DRIVE_DOCUMENT_MODEL_FOLDERS = {
  CONVITE: {name: '01 - Carta-convite', aliases: ['01 - Carta-convite', '01_CARTA_CONVITE']},
  ATA: {name: '02 - Ata de defesa', aliases: ['02 - Ata de defesa', '02_ATA_DEFESA']},
  TERMO: {name: '03 - Termo de autorização', aliases: ['03 - Termo de autorização', '03_TERMO_AUTORIZACAO']},
  DECLARACAO: {name: '04 - Declaração de participação', aliases: ['04 - Declaração de participação', '04_DECLARACAO_PARTICIPACAO']},
  AVALIACAO_LEGADO: {name: '05 - Instrumento de avaliação legado', aliases: ['05 - Instrumento de avaliação legado', '05_INSTRUMENTO_AVALIACAO', '05_INSTRUMENTO_AVALIACAO (Legado)']},
  COMPROVANTES_RESERVA: {name: '06 - Comprovantes de reserva', aliases: ['06 - Comprovantes de reserva', '06 — Comprovantes de reserva', '06. Comprovantes', '06_COMPROVANTES_RESERVA', '06_COMPORVANTES_RESERVA']},
  DECLARACAO_COMPARECIMENTO: {name: '07 - Declaração de comparecimento', aliases: ['07 - Declaração de comparecimento', '07_DECLARACAO_COMPARECIMENTO']},
  MANUAL: {name: '08 - Manual', aliases: ['08 - Manual', '08_MANUAL']},
  IDENTIDADE_VISUAL: {name: '09 - Identidade visual', aliases: ['09 - Identidade visual', '09_grafica']},
  NORMAS: {name: '10 - Normas', aliases: ['10 - Normas', '10_Normas']},
} as const;

/** Keep manifest keys compatible with installations already storing these IDs. */
export const DRIVE_MODEL_LIFECYCLE_FOLDERS = {
  '00_MODELO_ATIVO': {name: '00 - Modelo ativo', aliases: ['00 - Modelo ativo', '00_MODELO_ATIVO']},
  '01_HISTORICO_MODELOS': {name: '01 - Histórico de modelos', aliases: ['01 - Histórico de modelos', '01_HISTORICO_MODELOS']},
} as const;
