import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { cleanupTenant, signupTenant, type TestSession } from './helpers.js'
import { prisma } from '@/config/prisma.js'
import { platformSettingsRepository } from '@/repositories/platformSettings.repository.js'

// Notification preferences and platform settings used to be client-only
// toggles that claimed success without saving anything. These prove they
// now genuinely round-trip through the database.
describe('Settings persistence — notification preferences, platform settings', () => {
  let tenantA: TestSession
  let tenantB: TestSession

  beforeAll(async () => {
    tenantA = await signupTenant('settings-a')
    tenantB = await signupTenant('settings-b')
  })

  afterAll(async () => {
    await cleanupTenant(tenantA)
    await cleanupTenant(tenantB)
  })

  it('returns defaults for a brand-new membership', async () => {
    const res = await tenantA.agent.get('/api/notifications/preferences')
    expect(res.status).toBe(200)
    expect(res.body.preferences).toEqual({ newLead: true, campaignComplete: true, weeklyReport: false, mentions: true })
  })

  it('a preference change is actually persisted and survives a fresh read', async () => {
    const patch = await tenantA.agent.patch('/api/notifications/preferences').send({ weeklyReport: true, newLead: false })
    expect(patch.status).toBe(200)
    expect(patch.body.preferences.weeklyReport).toBe(true)

    const reread = await tenantA.agent.get('/api/notifications/preferences')
    expect(reread.body.preferences).toEqual({ newLead: false, campaignComplete: true, weeklyReport: true, mentions: true })

    const membership = await prisma.membership.findUniqueOrThrow({ where: { tenantId_userId: { tenantId: tenantA.tenantId, userId: tenantA.userId } } })
    expect(membership.notificationPreferences).toMatchObject({ weeklyReport: true, newLead: false })
  })

  it("one workspace's preferences never leak into another's", async () => {
    const res = await tenantB.agent.get('/api/notifications/preferences')
    expect(res.body.preferences).toEqual({ newLead: true, campaignComplete: true, weeklyReport: false, mentions: true })
  })

  it('rejects unknown preference keys instead of silently storing them', async () => {
    const res = await tenantA.agent.patch('/api/notifications/preferences').send({ notARealPreference: true })
    expect(res.status).toBe(400)
  })

  it('a regular workspace owner cannot read or change platform settings (super-admin only)', async () => {
    const get = await tenantA.agent.get('/api/admin/settings')
    expect(get.status).toBe(403)
    const patch = await tenantA.agent.patch('/api/admin/settings').send({ trialDays: 1 })
    expect(patch.status).toBe(403)
  })

  it('the configured trial length is actually applied to newly created workspaces, not just stored', async () => {
    const original = await platformSettingsRepository.get()
    try {
      await platformSettingsRepository.update({ trialDays: 3 })
      const fresh = await signupTenant('settings-trial')
      try {
        const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: fresh.tenantId } })
        const days = (tenant.trialEndsAt!.getTime() - Date.now()) / 86_400_000
        expect(days).toBeGreaterThan(2.9)
        expect(days).toBeLessThan(3.1)
      } finally {
        await cleanupTenant(fresh)
      }
    } finally {
      await platformSettingsRepository.update({ trialDays: original.trialDays })
    }
  })
})
