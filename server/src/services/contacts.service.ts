import { contactsRepository, type ListContactsFilters } from '@/repositories/contacts.repository.js'
import { assertUnderLimit } from '@/services/planLimits.service.js'
import { ApiError } from '@/utils/apiError.js'
import type { z } from 'zod'
import type { bulkContactActionSchema, createContactSchema, updateContactSchema } from '@/validators/contacts.validators.js'
import { prisma } from '@/config/prisma.js'
import type { Prisma } from '@prisma/client'

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
    const deleted = await contactsRepository.delete(tenantId, id)
    if (!deleted) throw ApiError.notFound('Contact not found')
  },

  async bulkAction(tenantId: string, input: z.infer<typeof bulkContactActionSchema>) {
    switch (input.action) {
      case 'delete':
        return { affected: await contactsRepository.bulkDelete(tenantId, input.contactIds) }
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
