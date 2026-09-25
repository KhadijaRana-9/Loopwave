import type { TemplateStatus } from '@prisma/client'

// Meta reports a template's lifecycle two ways — the `event` on a
// message_template_status_update webhook and the `status` on the Graph
// `GET /{waba}/message_templates` list — using the same vocabulary
// (APPROVED, REJECTED, PAUSED, PENDING, DISABLED, IN_APPEAL, FLAGGED,
// LIMIT_EXCEEDED, LOCKED, REINSTATED, ARCHIVED, UNARCHIVED, DELETED,
// PENDING_DELETION). Both paths must map through here: casting Meta's string
// straight onto the local enum throws a Prisma validation error for any value
// the enum doesn't have (e.g. DISABLED, IN_APPEAL).
//
// Anything Meta says is unusable for sending maps to PAUSED (never left as
// APPROVED, since only APPROVED templates are ever sent). States that don't
// change sendability (FLAGGED, UNARCHIVED) return undefined = leave as is.
const META_TEMPLATE_STATUS_MAP: Record<string, TemplateStatus> = {
  APPROVED: 'APPROVED',
  REINSTATED: 'APPROVED',
  PENDING: 'PENDING',
  IN_APPEAL: 'PENDING',
  REJECTED: 'REJECTED',
  PAUSED: 'PAUSED',
  DISABLED: 'PAUSED',
  LOCKED: 'PAUSED',
  LIMIT_EXCEEDED: 'PAUSED',
  ARCHIVED: 'PAUSED',
  DELETED: 'PAUSED',
  PENDING_DELETION: 'PAUSED',
}

export function mapMetaTemplateStatus(metaValue: string | undefined | null): TemplateStatus | undefined {
  if (!metaValue) return undefined
  return META_TEMPLATE_STATUS_MAP[metaValue.toUpperCase()]
}
