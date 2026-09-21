import type { Request, Response } from 'express';
import JSZip from 'jszip';
import { getGoogleWorkspaceAccessToken } from '../server/integrations/googleWorkspace';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const ZIP_MIME = 'application/zip';

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
type DownloadKey = ModelKey | 'all';

function modelKey(value: unknown): DownloadKey | null {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'all') return 'all';
  return Object.prototype.hasOwnProperty.call(REPLICATION_MODELS, normalized)
    ? normalized as ModelKey
    : null;
}

async function exportModel(key: ModelKey, accessToken: string) {
  const model = REPLICATION_MODELS[key];
  const url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(model.fileId)}/export?mimeType=${encodeURIComponent(DOCX_MIME)}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(20_000),
  });

  if (!response.ok) {
    console.error('[Replicação] Google Drive recusou a exportação do modelo:', key, response.status);
    throw new Error(`Falha ao exportar o modelo ${key}.`);
  }

  const content = Buffer.from(await response.arrayBuffer());
  if (!content.length || content.length > 16 * 1024 * 1024) {
    throw new Error(`O modelo ${key} retornado pelo Google Drive é inválido.`);
  }
  return { ...model, content };
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
    const accessToken = await getGoogleWorkspaceAccessToken();

    if (key === 'all') {
      const zip = new JSZip();
      const entries = await Promise.all(
        (Object.keys(REPLICATION_MODELS) as ModelKey[]).map((model) => exportModel(model, accessToken)),
      );
      entries.forEach((entry) => zip.file(entry.fileName, entry.content));
      const content = await zip.generateAsync({
        type: 'nodebuffer',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
      });
      if (!content.length || content.length > 64 * 1024 * 1024) {
        return res.status(502).json({ error: 'O pacote de modelos gerado é inválido.' });
      }
      const fileName = 'modelos-portal-tcc.zip';
      res.setHeader('Content-Type', ZIP_MIME);
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`);
      res.setHeader('Content-Length', String(content.length));
      return res.status(200).send(content);
    }

    const model = await exportModel(key, accessToken);
    res.setHeader('Content-Type', DOCX_MIME);
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(model.fileName)}`);
    res.setHeader('Content-Length', String(model.content.length));
    return res.status(200).send(model.content);
  } catch (error) {
    console.error('[Replicação] Falha ao preparar modelo público:', error);
    return res.status(502).json({ error: 'Não foi possível preparar os modelos para download.' });
  }
}
