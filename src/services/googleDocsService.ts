export interface GoogleDoc {
  documentId: string;
  title: string;
  revisionId?: string;
  body?: any;
}

export interface GoogleDocBrandingOptions {
  fontFamily: string;
  fontSize: number;
  lineSpacing: number;
  marginTop: number;
  marginBottom: number;
  marginLeft: number;
  marginRight: number;
  headerText: string;
  footerText: string;
  universityLogoUrl?: string;
  courseLogoUrl?: string;
  showUniversityLogo?: boolean;
  showCourseLogo?: boolean;
  variableStyles?: Array<{
    keys: string[];
    bold?: boolean;
    italic?: boolean;
    color?: string;
  }>;
}

export function extractGoogleDocumentId(urlOrId: string): string | null {
  if (!urlOrId) return null;
  const match = urlOrId.match(/\/d\/([a-zA-Z0-9_-]+)/) || urlOrId.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (match) return match[1];
  const trimmed = urlOrId.trim();
  return /^[a-zA-Z0-9_-]{15,}$/.test(trimmed) ? trimmed : null;
}

function hexToRgbColor(hex?: string): { red: number; green: number; blue: number } | undefined {
  if (!hex) return undefined;
  const value = hex.replace('#', '');
  if (!/^[0-9a-f]{6}$/i.test(value)) return undefined;
  return {
    red: parseInt(value.slice(0, 2), 16) / 255,
    green: parseInt(value.slice(2, 4), 16) / 255,
    blue: parseInt(value.slice(4, 6), 16) / 255
  };
}

function collectTextRuns(content: any[] = [], segmentId?: string): Array<{ text: string; startIndex: number; endIndex: number; segmentId?: string }> {
  const runs: Array<{ text: string; startIndex: number; endIndex: number; segmentId?: string }> = [];
  const visit = (items: any[], activeSegmentId?: string) => {
    items.forEach((element) => {
      (element.paragraph?.elements || []).forEach((item: any) => {
        if (!item.textRun?.content || typeof item.startIndex !== 'number' || typeof item.endIndex !== 'number') return;
        runs.push({ text: item.textRun.content, startIndex: item.startIndex, endIndex: item.endIndex, segmentId: activeSegmentId });
      });
      (element.table?.tableRows || []).forEach((row: any) => {
        (row.tableCells || []).forEach((cell: any) => visit(cell.content || [], activeSegmentId));
      });
    });
  };
  visit(content, segmentId);
  return runs;
}

function markerRegexForKey(key: string): RegExp {
  const normalized = key.replace(/^<<|>>$/g, '').replace(/^\{\{|\}\}$/g, '').replace(/^-|-$/g, '').trim();
  const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/_/g, '[\\s_-]+');
  return new RegExp(`(?:<<\\s*${escaped}\\s*>>|\\{\\{\\s*${escaped}\\s*\\}\\}|\\[\\[\\s*${escaped}\\s*\\]\\]|«\\s*${escaped}\\s*»|-${escaped}-)`, 'gi');
}

/**
 * Applies the professional layout directly to an existing Google Doc. This is
 * intentionally explicit (invoked by the Master) because it mutates the Drive
 * source model. Public HTTPS image URLs are required by Google Docs.
 */
export async function applyProfessionalGoogleDocDesign(
  accessToken: string,
  documentId: string,
  options: GoogleDocBrandingOptions
): Promise<{ styledVariables: number; headerUpdated: boolean; footerUpdated: boolean }> {
  const readDocument = async () => {
    const response = await fetch(`https://docs.googleapis.com/v1/documents/${documentId}`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `Erro ao ler o Google Docs (${response.status})`);
    }
    return response.json();
  };

  const sendBatch = async (requests: any[]) => {
    if (requests.length === 0) return null;
    const response = await fetch(`https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests })
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || 'Erro ao aplicar o padrão profissional no Google Docs');
    }
    return response.json();
  };

  let doc = await readDocument();
  const bodyEndIndex = Math.max(2, doc.body?.content?.[doc.body.content.length - 1]?.endIndex || 2);
  const cmToPt = (cm: number) => ({ magnitude: Math.max(0, cm) * 28.3465, unit: 'PT' });
  const requests: any[] = [
    {
      updateDocumentStyle: {
        documentStyle: {
          marginTop: cmToPt(options.marginTop),
          marginBottom: cmToPt(options.marginBottom),
          marginLeft: cmToPt(options.marginLeft),
          marginRight: cmToPt(options.marginRight)
        },
        fields: 'marginTop,marginBottom,marginLeft,marginRight'
      }
    },
    {
      updateTextStyle: {
        range: { startIndex: 1, endIndex: bodyEndIndex - 1 },
        textStyle: {
          weightedFontFamily: { fontFamily: options.fontFamily },
          fontSize: { magnitude: options.fontSize, unit: 'PT' }
        },
        fields: 'weightedFontFamily,fontSize'
      }
    },
    {
      updateParagraphStyle: {
        range: { startIndex: 1, endIndex: bodyEndIndex - 1 },
        paragraphStyle: { lineSpacing: Math.round(options.lineSpacing * 100) },
        fields: 'lineSpacing'
      }
    }
  ];

  let headerId = doc.documentStyle?.defaultHeaderId as string | undefined;
  let footerId = doc.documentStyle?.defaultFooterId as string | undefined;
  if (options.headerText && !headerId) requests.push({ createHeader: { type: 'DEFAULT' } });
  if (options.footerText && !footerId) requests.push({ createFooter: { type: 'DEFAULT' } });

  const bodyRuns = collectTextRuns(doc.body?.content || []);
  let styledVariables = 0;
  (options.variableStyles || []).forEach((style) => {
    const foregroundColor = hexToRgbColor(style.color);
    style.keys.forEach((key) => {
      bodyRuns.forEach((run) => {
        const regex = markerRegexForKey(key);
        let match: RegExpExecArray | null;
        while ((match = regex.exec(run.text)) !== null) {
          const textStyle: any = { bold: !!style.bold, italic: !!style.italic };
          const fields = ['bold', 'italic'];
          if (foregroundColor) {
            textStyle.foregroundColor = { color: { rgbColor: foregroundColor } };
            fields.push('foregroundColor');
          }
          requests.push({
            updateTextStyle: {
              range: { startIndex: run.startIndex + match.index, endIndex: run.startIndex + match.index + match[0].length },
              textStyle,
              fields: fields.join(',')
            }
          });
          styledVariables += 1;
        }
      });
    });
  });

  const firstBatch = await sendBatch(requests);
  if (!headerId) headerId = firstBatch?.replies?.find((reply: any) => reply.createHeader)?.createHeader?.headerId;
  if (!footerId) footerId = firstBatch?.replies?.find((reply: any) => reply.createFooter)?.createFooter?.footerId;

  doc = await readDocument();
  headerId = headerId || doc.documentStyle?.defaultHeaderId;
  footerId = footerId || doc.documentStyle?.defaultFooterId;
  const segmentRequests: any[] = [];

  const replaceSegment = (segment: any, segmentId: string, text: string) => {
    const content = segment?.content || [];
    const endIndex = content[content.length - 1]?.endIndex || 1;
    if (endIndex > 1) segmentRequests.push({ deleteContentRange: { range: { segmentId, startIndex: 0, endIndex: endIndex - 1 } } });
    if (text) segmentRequests.push({ insertText: { endOfSegmentLocation: { segmentId }, text } });
  };
  if (headerId && options.headerText) replaceSegment(doc.headers?.[headerId], headerId, options.headerText);
  if (footerId && options.footerText) replaceSegment(doc.footers?.[footerId], footerId, options.footerText);
  await sendBatch(segmentRequests);

  // Insert public logo URLs after the text operation so segment indexes are stable.
  doc = await readDocument();
  const imageRequests: any[] = [];
  const isPublicImage = (url?: string) => !!url && /^https:\/\//i.test(url) && !url.startsWith('data:');
  const logoUrls = [
    options.showUniversityLogo ? options.universityLogoUrl : '',
    options.showCourseLogo ? options.courseLogoUrl : ''
  ].filter(isPublicImage) as string[];
  if (headerId) {
    logoUrls.reverse().forEach((uri) => imageRequests.push({
      insertInlineImage: {
        location: { segmentId: headerId, index: 0 },
        uri,
        objectSize: { height: { magnitude: 34, unit: 'PT' } }
      }
    }));
  }
  await sendBatch(imageRequests);

  return { styledVariables, headerUpdated: !!headerId, footerUpdated: !!footerId };
}

/**
 * Creates a new Google Doc using the Google Docs REST API
 */
export async function createGoogleDoc(accessToken: string, title: string): Promise<GoogleDoc> {
  const response = await fetch('https://docs.googleapis.com/v1/documents', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title: title,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || 'Erro ao criar documento no Google Docs');
  }

  return response.json();
}

/**
 * Fetches the body of a Google Doc using the Google Docs API and extracts its text content
 */
export async function getGoogleDocContent(accessToken: string, documentId: string): Promise<string> {
  const response = await fetch(`https://docs.googleapis.com/v1/documents/${documentId}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Erro ao buscar o conteúdo do Google Doc (${response.status})`);
  }

  const doc = await response.json();
  let text = '';
  if (doc.body && doc.body.content) {
    for (const element of doc.body.content) {
      if (element.paragraph && element.paragraph.elements) {
        for (const run of element.paragraph.elements) {
          if (run.textRun && run.textRun.content) {
            text += run.textRun.content;
          }
        }
      }
    }
  }
  return text;
}

/**
 * Overwrites the entire content of a Google Doc.
 * First deletes the existing content, then inserts the new text.
 */
export async function updateGoogleDocContent(
  accessToken: string,
  documentId: string,
  newText: string
): Promise<void> {
  const docResponse = await fetch(`https://docs.googleapis.com/v1/documents/${documentId}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!docResponse.ok) {
    throw new Error('Falha ao ler o documento antes de atualizar');
  }
  const doc = await docResponse.json();
  
  let endIndex = 1;
  if (doc.body && doc.body.content) {
    const lastElement = doc.body.content[doc.body.content.length - 1];
    endIndex = lastElement.endIndex || 1;
  }

  const requests: any[] = [];
  
  if (endIndex > 2) {
    requests.push({
      deleteContentRange: {
        range: {
          startIndex: 1,
          endIndex: endIndex - 1,
        },
      },
    });
  }

  requests.push({
    insertText: {
      location: {
        index: 1,
      },
      text: newText,
    },
  });

  const updateResponse = await fetch(`https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ requests }),
  });

  if (!updateResponse.ok) {
    const errorData = await updateResponse.json().catch(() => ({}));
    throw new Error(errorData.error?.message || 'Erro ao atualizar o conteúdo do Google Doc');
  }
}

/**
 * Inserts formatted text into a Google Doc
 */
export async function insertTextInGoogleDoc(
  accessToken: string,
  documentId: string,
  text: string,
  index: number = 1
): Promise<void> {
  const response = await fetch(`https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      requests: [
        {
          insertText: {
            location: { index },
            text: text,
          },
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || 'Erro ao atualizar texto no Google Doc');
  }
}

/**
 * Generates an official TCC document as a Google Doc and returns the web link
 */
export async function generateOfficialDocInGoogleDocs(
  accessToken: string,
  docTitle: string,
  docContent: string
): Promise<{ documentId: string; docUrl: string }> {
  const doc = await createGoogleDoc(accessToken, docTitle);
  await insertTextInGoogleDoc(accessToken, doc.documentId, docContent, 1);
  const docUrl = `https://docs.google.com/document/d/${doc.documentId}/edit`;
  return { documentId: doc.documentId, docUrl };
}
