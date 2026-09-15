import type { Request, Response } from 'express'
import { pipelineService } from '@/services/pipeline.service.js'
import { asyncHandler } from '@/utils/asyncHandler.js'
import { ApiError } from '@/utils/apiError.js'

function tenantId(req: Request): string {
  if (!req.auth?.tenantId) throw ApiError.forbidden('No active workspace for this session')
  return req.auth.tenantId
}

export const pipelineController = {
  listStages: asyncHandler(async (req: Request, res: Response) => {
    res.json({ stages: await pipelineService.listStages(tenantId(req)) })
  }),

  listDeals: asyncHandler(async (req: Request, res: Response) => {
    res.json({ deals: await pipelineService.listDeals(tenantId(req)) })
  }),

  getDeal: asyncHandler(async (req: Request, res: Response) => {
    res.json({ deal: await pipelineService.getById(tenantId(req), req.params.id as string) })
  }),

  createDeal: asyncHandler(async (req: Request, res: Response) => {
    const deal = await pipelineService.create(tenantId(req), req.body)
    res.status(201).json({ deal })
  }),

  updateDeal: asyncHandler(async (req: Request, res: Response) => {
    const deal = await pipelineService.update(tenantId(req), req.params.id as string, req.body)
    res.json({ deal })
  }),

  addNote: asyncHandler(async (req: Request, res: Response) => {
    const note = await pipelineService.addNote(tenantId(req), req.params.id as string, req.auth?.sub, req.body.text)
    res.status(201).json({ note })
  }),
}
