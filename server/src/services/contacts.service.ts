import { contactsRepository, type ListContactsFilters } from '@/repositories/contacts.repository.js'
import { assertUnderLimit } from '@/services/planLimits.service.js'
import { ApiError } from '@/utils/apiError.js'
import type { z } from 'zod'
import type { bulkContactActionSchema, createContactSchema, updateContactSchema } from '@/validators/contacts.validators.js'
import { prisma } from '@/config/prisma.js'
import { deleteObject, isStorageConfigured } from '@/integrations/storage.adapter.js'
import type { Prisma } from '@prisma/client'

// Deleting a contact cascades (DB-level, Prisma onDelete: Cascade) to its
// conversations and messages, but that only removes the rows — it has no way
// to know about, or reach, the actual files those messages' mediaUrl keys
// point to in object storage. Without this, every deleted contact that ever
// sent/received media leaves its files behind forever, unreachable by any
// tenant. Collected BEFORE the delete (the rows won't exist after), cleaned
// up AFTER it (so a storage failure never blocks the delete the tenant
// asked for) — and only best-effort: one missing/already-gone object must
// not surface as an error for an otherwise-successful contact delete.
async function collectMediaKeys(tenantId: string, contactIds: string[]): Promise<string[]> {
  if (!isStorageConfigured() || contactIds.length === 0) return []
  const messages = await prisma.message.findMany({
    where: { conversation: { tenantId, contactId: { in: contactIds } }, mediaUrl: { not: null } },
    select: { mediaUrl: true },
  })
  return messages.map((m) => m.mediaUrl).filter((key): key is string => !!key)
}

async function cleanupMediaKeys(keys: string[]): Promise<void> {
  await Promise.all(keys.map((key) => deleteObject(key).catch(() => {})))
}

export const contactsService = {
  list(tenantId: string, filters: ListContactsFilters) {
    return contactsRepository.list(tenantId, filters)
  },

  facets(tenantId: string) {
    return contactsRepository.facets(tenantId)
  },

  async getById(tenantId: string, id: string) {
    const contact = await contactsRepository.findById(tenantId, id)
    if (!contact) throw ApiError.notFound('Contact not found')
    return contact
  },

  async create(tenantId: string, input: z.infer<typeof createContactSchema>) {
    const existing = await contactsRepository.findByPhone(tenantId, input.phone)
    if (existing) throw ApiError.conflict('A contact with this phone number already exists.')

    const currentCount = await contactsRepository.count(tenantId)
    await assertUnderLimit(tenantId, 'contacts', currentCount)

    const { tags, ...rest } = input
    // zod already guarantees customFields is a plain JSON-safe object; Prisma's
    // JsonValue type just doesn't structurally match Record<string, unknown>.
    return contactsRepository.create(tenantId, rest as unknown as Omit<Prisma.ContactUncheckedCreateInput, 'tenantId'>, tags)
  },

  async update(tenantId: string, id: string, input: z.infer<typeof updateContactSchema>) {
    const { tags, ...rest } = input
    const updated = await contactsRepository.update(tenantId, id, rest as unknown as Prisma.ContactUncheckedUpdateInput, tags)
    if (!updated) throw ApiError.notFound('Contact not found')
    return updated
  },

  async remove(tenantId: string, id: string) {
    const mediaKeys = await collectMediaKeys(tenantId, [id])
    const deleted = await contactsRepository.delete(tenantId, id)
    if (!deleted) throw ApiError.notFound('Contact not found')
    await cleanupMediaKeys(mediaKeys)
  },

  async bulkAction(tenantId: string, input: z.infer<typeof bulkContactActionSchema>) {
    switch (input.action) {
      case 'delete': {
        const mediaKeys = await collectMediaKeys(tenantId, input.contactIds)
        const affected = await contactsRepository.bulkDelete(tenantId, input.contactIds)
        await cleanupMediaKeys(mediaKeys)
        return { affected }
      }
      case 'setStatus':
        if (!input.leadStatus) throw ApiError.badRequest('leadStatus is required for this action')
        return { affected: await contactsRepository.bulkSetStatus(tenantId, input.contactIds, input.leadStatus) }
      case 'assign':
        if (!input.assignedAgentId) throw ApiError.badRequest('assignedAgentId is required for this action')
        return { affected: await contactsRepository.bulkAssign(tenantId, input.contactIds, input.assignedAgentId) }
      case 'tag':
        if (!input.tag) throw ApiError.badRequest('tag is required for this action')
        return { affected: await contactsRepository.bulkTag(tenantId, input.contactIds, input.tag) }
    }
  },

  async addNote(tenantId: string, contactId: string, authorId: string | undefined, text: string) {
    const contact = await prisma.contact.findFirst({ where: { id: contactId, tenantId }, select: { id: true } })
    if (!contact) throw ApiError.notFound('Contact not found')
    return contactsRepository.addNote(tenantId, contactId, authorId, text)
  },
}
