import { whatsappRepository } from '@/repositories/whatsapp.repository.js'
import { notifyTenant } from '@/services/notifications.service.js'

const WARNING_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

// Proactive half of token-expiry handling — the reactive half (flipping a
// number to REAUTHORIZATION_REQUIRED after a real send fails with Meta
// error 190) lives in conversations.service.ts#flagAuthErrorIfNeeded. This
// runs before any send ever fails, so a tenant isn't surprised by a
// blocked campaign the day their token actually expires. Notify-only — it
// never changes connection status itself, since the token may still be
// valid right up until it isn't.
export async function checkExpiringWhatsAppTokens(): Promise<number> {
  const accounts = await whatsappRepository.findAccountsWithExpiringTokens(WARNING_WINDOW_MS)

  for (const account of accounts) {
    const daysLeft = Math.max(0, Math.ceil((account.tokenExpiresAt!.getTime() - Date.now()) / 86_400_000))
    const number = account.phoneNumbers[0]
    const label = number?.label ?? number?.displayNumber ?? account.businessName ?? 'Your WhatsApp number'

    await notifyTenant(account.tenantId, {
      category: 'integration_error',
      title: 'WhatsApp connection expiring soon',
      body: `${label} will need to be reconnected within ${daysLeft} day${daysLeft === 1 ? '' : 's'} — reconnect it in WhatsApp settings to avoid interrupted sending.`,
    })
  }

  return accounts.length
}
