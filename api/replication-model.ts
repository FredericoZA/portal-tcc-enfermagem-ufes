import type { Request, Response } from 'express';
import { getGoogleWorkspaceAccessToken } from '../server/integrations/googleWorkspace';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

const REPLICATION_MODELS = {
  convite: {
    fileId: '19P4RRSyipmwAPvtpGiurX9p50BOXpdp01RXK7EGx_jE',
    fileName: 'modelo-convite-defesa.docx',
  },
  ata: {
    fileId: '1Jif3q8DoqlV3vw2_iVB2Tb24BDGSk_KCJ7QTqx0Jqko',
    fileName: 'modelo-ata-defesa.docx',
  },
  termo: {
    fileId: '1UjJgDPQax370hH2STZrNsZKPsLNnTPBkzca5VsyOJ3U',
    fileName: 'modelo-termo-autorizacao.docx',
  },
  declaracao: {
    fileId: '1OhbNZqPntrQHTJvwDor9Tw6hnzEsCVV1QMfUutKfZqg',
    fileName: 'modelo-declaracao-banca.docx',
  },
} as const;

type ModelKey = keyof typeof REPLICATION_MODELS;

function modelKey(value: unknown): ModelKey | null {
  const normalized = String(value || '').trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(REPLICATION_MODELS, normalized)
    ? normalized as ModelKey
    : null;
}

export default async function handler(req: Request, res: Response) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  const key = modelKey(req.query?.slug);
  if (!key) return res.status(404).json({ error: 'Modelo não localizado.' });

  try {
    const model = REPLICATION_MODELS[key];
    const accessToken = await getGoogleWorkspaceAccessToken();
    const url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(model.fileId)}/export?mimeType=${encodeURIComponent(DOCX_MIME)}`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(20_000),
    });

    if (!response.ok) {
      console.error('[Replicação] Google Drive recusou a exportação do modelo:', key, response.status);
      return res.status(502).json({ error: 'Não foi possível preparar o modelo para download.' });
    }

    const content = Buffer.from(await response.arrayBuffer());
    if (!content.length || content.length > 16 * 1024 * 1024) {
      return res.status(502).json({ error: 'O modelo retornado pelo Google Drive é inválido.' });
    }

    res.setHeader('Content-Type', DOCX_MIME);
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(model.fileName)}`);
    res.setHeader('Content-Length', String(content.length));
    return res.status(200).send(content);
  } catch (error) {
    console.error('[Replicação] Falha ao preparar modelo público:', error);
    return res.status(502).json({ error: 'Não foi possível preparar o modelo para download.' });
  }
}
