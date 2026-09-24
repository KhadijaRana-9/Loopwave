import type { Request, Response } from 'express'
import { campaignsService } from '@/services/campaigns.service.js'
import { asyncHandler } from '@/utils/asyncHandler.js'
import { ApiError } from '@/utils/apiError.js'

function tenantId(req: Request): string {
  if (!req.auth?.tenantId) throw ApiError.forbidden('No active workspace for this session')
  return req.auth.tenantId
}

export const campaignsController = {
  list: asyncHandler(async (req: Request, res: Response) => res.json({ campaigns: await campaignsService.list(tenantId(req)) })),
  get: asyncHandler(async (req: Request, res: Response) => res.json({ campaign: await campaignsService.getById(tenantId(req), req.params.id as string) })),
  create: asyncHandler(async (req: Request, res: Response) => {
    const campaign = await campaignsService.create(tenantId(req), req.body)
    res.status(201).json({ campaign })
  }),
  duplicate: asyncHandler(async (req: Request, res: Response) => {
    const campaign = await campaignsService.duplicate(tenantId(req), req.params.id as string)
    res.status(201).json({ campaign })
  }),
  cancel: asyncHandler(async (req: Request, res: Response) => {
    res.json({ campaign: await campaignsService.cancelScheduled(tenantId(req), req.params.id as string) })
  }),
  previewAudience: asyncHandler(async (req: Request, res: Response) => {
    res.json(await campaignsService.previewAudience(tenantId(req), req.body.audienceFilter))
  }),
  compose: asyncHandler(async (req: Request, res: Response) => {
    res.json(await campaignsService.composeMessage(tenantId(req), req.body))
  }),
  uploadHeaderMedia: asyncHandler(async (req: Request, res: Response) => {
    const file = (req as Request & { file?: Express.Multer.File }).file
    if (!file) throw ApiError.badRequest('No file uploaded')
    res.json(await campaignsService.uploadHeaderMedia(tenantId(req), { buffer: file.buffer, mimeType: file.mimetype, filename: file.originalname }))
  }),
}
