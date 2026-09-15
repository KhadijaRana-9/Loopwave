import type { Request, Response } from 'express'
import { chatbotsService } from '@/services/chatbots.service.js'
import { asyncHandler } from '@/utils/asyncHandler.js'
import { ApiError } from '@/utils/apiError.js'

function tenantId(req: Request): string {
  if (!req.auth?.tenantId) throw ApiError.forbidden('No active workspace for this session')
  return req.auth.tenantId
}

export const chatbotsController = {
  list: asyncHandler(async (req: Request, res: Response) => res.json({ chatbots: await chatbotsService.list(tenantId(req)) })),
  get: asyncHandler(async (req: Request, res: Response) => res.json({ chatbot: await chatbotsService.getById(tenantId(req), req.params.id as string) })),
  create: asyncHandler(async (req: Request, res: Response) => {
    const chatbot = await chatbotsService.create(tenantId(req), req.body)
    res.status(201).json({ chatbot })
  }),
  update: asyncHandler(async (req: Request, res: Response) => {
    res.json({ chatbot: await chatbotsService.update(tenantId(req), req.params.id as string, req.body) })
  }),
  remove: asyncHandler(async (req: Request, res: Response) => {
    await chatbotsService.remove(tenantId(req), req.params.id as string)
    res.status(204).send()
  }),
}
