/** Revalidate Portal publication permission before calling this helper.
 * A 304 reuses only the exact bytes previously approved by this hash. */
export function publicPdfEtag(sha256:unknown):string|undefined {
  return typeof sha256==='string'&&/^[a-f0-9]{64}$/i.test(sha256)?`"portal-pdf-${sha256.toLowerCase()}"`:undefined;
}
export function matchesPublicPdfEtag(header:unknown,etag:string|undefined):boolean {
  return Boolean(etag&&typeof header==='string'&&header.length<=2048&&header.split(',').some(value=>value.trim()===etag));
}
export const PUBLIC_PDF_CACHE_CONTROL='private, no-cache, max-age=0, must-revalidate';
