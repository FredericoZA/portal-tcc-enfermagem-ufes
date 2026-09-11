export interface SendEmailParams {
  to: string;
  subject: string;
  bodyText: string;
}

/**
 * Encodes an RFC 2822 email message to URL-safe Base64 as required by the Gmail API
 */
function createRawEmail({ to, subject, bodyText }: SendEmailParams): string {
  const emailLines = [
    `To: ${to}`,
    `Subject: =?utf-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`,
    'Content-Type: text/plain; charset=utf-8',
    'MIME-Version: 1.0',
    '',
    bodyText,
  ];

  const email = emailLines.join('\r\n');
  return btoa(unescape(encodeURIComponent(email)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Sends an official notification email via the user's Gmail account
 */
export async function sendGmailMessage(accessToken: string, params: SendEmailParams): Promise<any> {
  const raw = createRawEmail(params);

  const response = await fetch('https://gmail.googleapis.com/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || 'Erro ao enviar e-mail pelo Gmail');
  }

  return response.json();
}

/**
 * Creates a draft email in the user's Gmail account
 */
export async function createGmailDraft(accessToken: string, params: SendEmailParams): Promise<any> {
  const raw = createRawEmail(params);

  const response = await fetch('https://gmail.googleapis.com/v1/users/me/drafts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: { raw },
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || 'Erro ao criar rascunho de e-mail no Gmail');
  }

  return response.json();
}
