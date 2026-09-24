import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { checkExpiringWhatsAppTokens } from '@/services/whatsappTokenExpiry.service.js'
import { cleanupTenant, signupTenant, type TestSession } from './helpers.js'
import { prisma } from '@/config/prisma.js'

// Proactive token-expiry checker — pure DB + notification logic, no Meta
// network call involved (unlike whatsapp-templates.test.ts), so this needs
// no live-credential gate. See server/src/jobs/whatsappTokenExpiry.job.ts
// for how this same function is actually scheduled in production.
describe('WhatsApp proactive token-expiry check', () => {
  let tenant: TestSession
  let expiringAccountId: string
  let farFutureAccountId: string

  beforeAll(async () => {
    tenant = await signupTenant('whatsapp-token-expiry')

    const expiringAccount = await prisma.whatsAppAccount.create({
      data: { tenantId: tenant.tenantId, wabaId: `expiring-waba-${Date.now()}`, tokenExpiresAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000) },
    })
    expiringAccountId = expiringAccount.id
    await prisma.whatsAppPhoneNumber.create({
      data: { accountId: expiringAccountId, displayNumber: '+15550009999', label: 'Expiring Soon Line', status: 'CONNECTED', connectedAt: new Date() },
    })

    const farFutureAccount = await prisma.whatsAppAccount.create({
      data: { tenantId: tenant.tenantId, wabaId: `far-future-waba-${Date.now()}`, tokenExpiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) },
    })
    farFutureAccountId = farFutureAccount.id
    await prisma.whatsAppPhoneNumber.create({
      data: { accountId: farFutureAccountId, displayNumber: '+15550008888', label: 'Fine For Now Line', status: 'CONNECTED', connectedAt: new Date() },
    })
  })

  afterAll(async () => {
    await cleanupTenant(tenant)
  })

  it('notifies the tenant for an account whose token expires within the warning window, and not for one far in the future', async () => {
    const notifiedCount = await checkExpiringWhatsAppTokens()
    expect(notifiedCount).toBeGreaterThanOrEqual(1)

    const notifications = await prisma.notification.findMany({ where: { tenantId: tenant.tenantId, category: 'integration_error' } })
    const expiryNotifications = notifications.filter((n) => n.title.includes('expiring soon'))
    expect(expiryNotifications).toHaveLength(1)
    const [notification] = expiryNotifications
    expect(notification!.body).toMatch(/expiring soon line/i)
    expect(notification!.body).not.toMatch(/fine for now line/i)
  })

  it('does not change connection status — notify-only, since the token may still be valid until actual expiry', async () => {
    await checkExpiringWhatsAppTokens()
    const number = await prisma.whatsAppPhoneNumber.findFirstOrThrow({ where: { accountId: expiringAccountId } })
    expect(number.status).toBe('CONNECTED')
  })
})
