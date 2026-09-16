import type { Request, Response } from 'express'
import { contactsService } from '@/services/contacts.service.js'
import { asyncHandler } from '@/utils/asyncHandler.js'
import { ApiError } from '@/utils/apiError.js'
import { serializeContact } from '@/utils/serializers.js'
import type { ListContactsFilters } from '@/repositories/contacts.repository.js'

function tenantId(req: Request): string {
  if (!req.auth?.tenantId) throw ApiError.forbidden('No active workspace for this session')
  return req.auth.tenantId
}

export const contactsController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    // req.query has already been replaced with the parsed, typed object by
    // the validate() middleware — the cast reflects that, not raw ParsedQs.
    const filters = req.query as unknown as ListContactsFilters
    const { items, total } = await contactsService.list(tenantId(req), filters)
    res.json({
      items: items.map(serializeContact),
      page: filters.page,
      pageSize: filters.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / filters.pageSize)),
    })
  }),

  facets: asyncHandler(async (req: Request, res: Response) => {
    res.json(await contactsService.facets(tenantId(req)))
  }),

  get: asyncHandler(async (req: Request, res: Response) => {
    const contact = await contactsService.getById(tenantId(req), req.params.id as string)
    res.json({ contact: serializeContact(contact) })
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const contact = await contactsService.create(tenantId(req), req.body)
    res.status(201).json({ contact: serializeContact(contact) })
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const contact = await contactsService.update(tenantId(req), req.params.id as string, req.body)
    res.json({ contact: serializeContact(contact) })
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    await contactsService.remove(tenantId(req), req.params.id as string)
    res.status(204).send()
  }),

  bulkAction: asyncHandler(async (req: Request, res: Response) => {
    const result = await contactsService.bulkAction(tenantId(req), req.body)
    res.json(result)
  }),

  addNote: asyncHandler(async (req: Request, res: Response) => {
    const note = await contactsService.addNote(tenantId(req), req.params.id as string, req.auth?.sub, req.body.text)
    res.status(201).json({ note })
  }),
}
