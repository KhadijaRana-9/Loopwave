import { prisma } from '@/config/prisma.js'

// Single-row table — there is exactly one platform. Auto-created with
// defaults on first read so callers never have to handle "no row yet".
export const platformSettingsRepository = {
  async get() {
    const existing = await prisma.platformSettings.findFirst()
    if (existing) return existing
    return prisma.platformSettings.create({ data: {} })
  },

  async update(data: { platformName?: string; supportEmail?: string; trialDays?: number }) {
    const current = await this.get()
    return prisma.platformSettings.update({ where: { id: current.id }, data })
  },
}
