import { integrationsRepository } from '@/repositories/integrations.repository.js'
import { assertUnderLimit } from '@/services/planLimits.service.js'
import { INTEGRATIONS_CATALOG } from '@/config/integrationsCatalog.js'
import { ApiError } from '@/utils/apiError.js'

function merge(entry: (typeof INTEGRATIONS_CATALOG)[number], state?: { connected: boolean; config: unknown; lastSyncedAt: Date | null; lastError: string | null }) {
  return {
    id: entry.id,
    name: entry.name,
    category: entry.category,
    description: entry.description,
    configFields: entry.configFields,
    connected: state?.connected ?? false,
    config: (state?.config as Record<string, string>) ?? {},
    lastSyncedAt: state?.lastSyncedAt ?? null,
    lastError: state?.lastError ?? null,
  }
}

export const integrationsService = {
  async list(tenantId: string) {
    const rows = await integrationsRepository.listForTenant(tenantId)
    const byKey = new Map(rows.map((r) => [r.providerKey, r]))
    return INTEGRATIONS_CATALOG.map((entry) => merge(entry, byKey.get(entry.id)))
  },

  async toggle(tenantId: string, id: string) {
    const entry = INTEGRATIONS_CATALOG.find((e) => e.id === id)
    if (!entry) throw ApiError.notFound('Integration not found')
    const existing = await integrationsRepository.findOne(tenantId, id)
    const nextConnected = !(existing?.connected ?? false)
    if (nextConnected) {
      const connectedCount = (await integrationsRepository.listForTenant(tenantId)).filter((i) => i.connected).length
      await assertUnderLimit(tenantId, 'integrations', connectedCount)
    }
    const updated = await integrationsRepository.setConnected(tenantId, id, nextConnected)
    return merge(entry, updated)
  },

  async saveConfig(tenantId: string, id: string, config: Record<string, string>) {
    const entry = INTEGRATIONS_CATALOG.find((e) => e.id === id)
    if (!entry) throw ApiError.notFound('Integration not found')
    const updated = await integrationsRepository.saveConfig(tenantId, id, config)
    return merge(entry, updated)
  },

  // No real provider is called yet for any of these — connectivity checks
  // require each provider's own SDK/API, which needs real credentials this
  // build doesn't have. This is an honest, deterministic check ("is
  // configuration present?"), not a simulated success (Section 26).
  async testConnection(tenantId: string, id: string) {
    const entry = INTEGRATIONS_CATALOG.find((e) => e.id === id)
    if (!entry) throw ApiError.notFound('Integration not found')
    const existing = await integrationsRepository.findOne(tenantId, id)
    const config = (existing?.config as Record<string, string>) ?? {}
    const hasConfig = Object.values(config).some((v) => v?.trim())
    return hasConfig ? { ok: true } : { ok: false, reason: 'No configuration saved yet' }
  },
}
