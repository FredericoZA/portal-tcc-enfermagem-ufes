/** Reservation links are bearer credentials. Never retain their tokens in access logs. */
export function safeApiLogPath(path: string): string {
  return path
    .split('?')[0]
    .replace(/(\/reservation-confirmation\/)[^/]+/gi, '$1[redacted]')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .slice(0, 256);
}
