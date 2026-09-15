import type { Request, Response } from 'express'
import { automationsService } from '@/services/automations.service.js'
import { asyncHandler } from '@/utils/asyncHandler.js'
import { ApiError } from '@/utils/apiError.js'

function tenantId(req: Request): string {
  if (!req.auth?.tenantId) throw ApiError.forbidden('No active workspace for this session')
  return req.auth.tenantId
}

export const automationsController = {
  list: asyncHandler(async (req: Request, res: Response) => res.json({ automations: await automationsService.list(tenantId(req)) })),
  get: asyncHandler(async (req: Request, res: Response) => res.json({ automation: await automationsService.getById(tenantId(req), req.params.id as string) })),
  create: asyncHandler(async (req: Request, res: Response) => {
    const automation = await automationsService.create(tenantId(req), req.body)
    res.status(201).json({ automation })
  }),
  update: asyncHandler(async (req: Request, res: Response) => {
    res.json({ automation: await automationsService.update(tenantId(req), req.params.id as string, req.body) })
  }),
  toggle: asyncHandler(async (req: Request, res: Response) => {
    res.json({ automation: await automationsService.toggleStatus(tenantId(req), req.params.id as string) })
  }),
  test: asyncHandler(async (req: Request, res: Response) => {
    res.json({ execution: await automationsService.test(tenantId(req), req.params.id as string) })
  }),
  executions: asyncHandler(async (req: Request, res: Response) => {
    res.json({ executions: await automationsService.listExecutions(tenantId(req), req.params.id as string) })
  }),
}
