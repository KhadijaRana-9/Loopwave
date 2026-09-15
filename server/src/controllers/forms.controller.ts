import type { Request, Response } from 'express'
import { formsService } from '@/services/forms.service.js'
import { asyncHandler } from '@/utils/asyncHandler.js'
import { ApiError } from '@/utils/apiError.js'

function tenantId(req: Request): string {
  if (!req.auth?.tenantId) throw ApiError.forbidden('No active workspace for this session')
  return req.auth.tenantId
}

export const formsController = {
  list: asyncHandler(async (req: Request, res: Response) => res.json({ forms: await formsService.list(tenantId(req)) })),
  create: asyncHandler(async (req: Request, res: Response) => {
    const form = await formsService.create(tenantId(req), req.body)
    res.status(201).json({ form })
  }),
  update: asyncHandler(async (req: Request, res: Response) => {
    res.json({ form: await formsService.update(tenantId(req), req.params.id as string, req.body) })
  }),
  remove: asyncHandler(async (req: Request, res: Response) => {
    await formsService.remove(tenantId(req), req.params.id as string)
    res.status(204).send()
  }),
  submissions: asyncHandler(async (req: Request, res: Response) => {
    res.json({ submissions: await formsService.listSubmissions(tenantId(req), req.params.id as string) })
  }),
  submitPublic: asyncHandler(async (req: Request, res: Response) => {
    const submission = await formsService.submitPublic(req.params.id as string, req.body.values)
    res.status(201).json({ submission })
  }),
}
