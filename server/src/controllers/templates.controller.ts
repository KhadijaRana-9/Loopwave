import type { Request, Response } from 'express'
import { templatesService } from '@/services/templates.service.js'
import { asyncHandler } from '@/utils/asyncHandler.js'
import { ApiError } from '@/utils/apiError.js'
import { serializeTemplate } from '@/utils/serializers.js'

function tenantId(req: Request): string {
  if (!req.auth?.tenantId) throw ApiError.forbidden('No active workspace for this session')
  return req.auth.tenantId
}

export const templatesController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    res.json({ templates: (await templatesService.list(tenantId(req))).map(serializeTemplate) })
  }),
  create: asyncHandler(async (req: Request, res: Response) => {
    const template = await templatesService.create(tenantId(req), req.body)
    res.status(201).json({ template: serializeTemplate(template) })
  }),
  update: asyncHandler(async (req: Request, res: Response) => {
    const template = await templatesService.update(tenantId(req), req.params.id as string, req.body)
    res.json({ template: serializeTemplate(template) })
  }),
  submit: asyncHandler(async (req: Request, res: Response) => {
    const template = await templatesService.submitForReview(tenantId(req), req.params.id as string)
    res.json({ template: serializeTemplate(template) })
  }),
  sync: asyncHandler(async (req: Request, res: Response) => {
    const result = await templatesService.syncFromMeta(tenantId(req))
    res.json(result)
  }),
  remove: asyncHandler(async (req: Request, res: Response) => {
    await templatesService.remove(tenantId(req), req.params.id as string)
    res.status(204).send()
  }),
}
