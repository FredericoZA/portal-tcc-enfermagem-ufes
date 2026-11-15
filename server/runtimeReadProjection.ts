/**
 * Only audited, read-only GET routes may omit audit history from hydration.
 * LEAN retains processes, settings, memberships, signature jobs and document
 * revisions; LITE additionally retains the historical academic catalog.
 * Neither projection changes the route's own authorization or PDF checks.
 */
export type RuntimeReadProjection = 'FULL' | 'LITE' | 'LEAN';

const LITE_PATHS = new Set([
  '/me',
  '/settings',
  '/setup/status',
  '/capabilities',
  '/academic-cycles',
  '/admin/academic-cycles',
  '/admin/feature-flags',
  '/admin/installation-profile',
  '/admin/metrics',
  '/admin/metrics/definitions',
  '/admin/analytics/advanced',
  '/admin/indicators',
  '/public/installation-profile',
  '/public/indicators',
  '/public/repository',
  '/public/calendar',
  '/processes',
  '/registration/bootstrap',
  '/registration/draft',
  '/forms/registration-schema',
  '/admin/studio/versions',
  '/legacy-academic-records',
  '/admin/legacy-academic-records',
  '/notification-preferences',
  '/administration-transfers/pending',
  '/admin/administration-transfers',
  '/sync/version',
]);

const LEAN_PATHS = new Set([
  '/admin/resource-usage',
  '/me',
  '/settings',
  '/setup/status',
  '/capabilities',
  '/academic-cycles',
  '/admin/academic-cycles',
  '/admin/feature-flags',
  '/admin/installation-profile',
  '/admin/metrics',
  '/admin/metrics/definitions',
  '/admin/analytics/advanced',
  '/public/installation-profile',
  '/public/calendar',
  '/processes',
  '/registration/bootstrap',
  '/registration/draft',
  '/forms/registration-schema',
  '/forms/registration-suggestions',
  '/admin/studio/versions',
  '/notification-preferences',
  '/administration-transfers/pending',
  '/admin/administration-transfers',
  '/sync/version',
]);

const CURRENT_PROCESS_READS = [
  /^\/processes\/[^/?#]+$/,
  /^\/processes\/[^/?#]+\/data-review\/schema$/,
  /^\/table-preferences\/[^/?#]+$/,
  /^\/public\/processes\/[^/?#]+\/reservation-receipts$/,
  /^\/public\/processes\/[^/?#]+\/reservation-receipt$/,
  /^\/public\/processes\/[^/?#]+\/documents\/[^/?#]+\/download$/,
  /^\/public\/processes\/[^/?#]+\/files\/(?:trabalho-completo|resumo-expandido)\/download$/,
  /^\/processes\/[^/?#]+\/files\/(?:trabalho-completo|resumo-expandido)\/download$/,
];

export function runtimeReadProjection(
  method: string,
  requestPath: string,
): RuntimeReadProjection {
  // Mutations, audit feeds, exports and every unreviewed endpoint fail closed
  // to the canonical state, including new routes added in future changes.
  if (method !== 'GET') return 'FULL';
  if (
    LEAN_PATHS.has(requestPath) ||
    CURRENT_PROCESS_READS.some((pattern) => pattern.test(requestPath))
  )
    return 'LEAN';
  // The public process reference may resolve to a historical record. Keep the
  // complete catalog here; stripping it would silently turn a valid link into 404.
  if (
    LITE_PATHS.has(requestPath) ||
    /^\/public\/processes\/[^/?#]+$/.test(requestPath) ||
    /^\/legacy-academic-records\/[^/?#]+\/files\/(?:0|[1-9]\d?)\/download$/.test(
      requestPath,
    )
  )
    return 'LITE';
  return 'FULL';
}
