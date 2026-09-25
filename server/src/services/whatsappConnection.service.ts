import { whatsappRepository } from '@/repositories/whatsapp.repository.js'
import { notifyTenant } from '@/services/notifications.service.js'

// Called by EVERY send path (Inbox replies, campaign dispatch) the moment
// Meta says the tenant's token is no longer valid (see
// whatsapp.adapter.ts#authError): persists REAUTHORIZATION_REQUIRED so all
// further sends are blocked up-front, and tells the tenant — never a silent
// DB flip. Returns whether a connected number was actually flagged.
export async function flagReauthRequired(tenantId: string): Promise<boolean> {
  const connected = await whatsappRepository.getConnectedCredentials(tenantId)
  if (!connected) return false
  await whatsappRepository.updateNumberStatus(connected.id, 'REAUTHORIZATION_REQUIRED')
  await notifyTenant(tenantId, {
    category: 'integration_error',
    title: 'WhatsApp connection needs reauthorization',
    body: `Meta rejected a message sent from ${connected.label ?? connected.displayNumber} — reconnect it in WhatsApp settings to resume sending.`,
  })
  return true
}
