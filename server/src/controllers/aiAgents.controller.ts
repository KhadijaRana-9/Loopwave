import type { Request, Response } from 'express'
import { aiAgentsService } from '@/services/aiAgents.service.js'
import { asyncHandler } from '@/utils/asyncHandler.js'
import { ApiError } from '@/utils/apiError.js'

function tenantId(req: Request): string {
  if (!req.auth?.tenantId) throw ApiError.forbidden('No active workspace for this session')
  return req.auth.tenantId
}

export const aiAgentsController = {
  list: asyncHandler(async (req: Request, res: Response) => res.json({ agents: await aiAgentsService.list(tenantId(req)) })),
  get: asyncHandler(async (req: Request, res: Response) => res.json({ agent: await aiAgentsService.getById(tenantId(req), req.params.id as string) })),
  create: asyncHandler(async (req: Request, res: Response) => {
    const agent = await aiAgentsService.create(tenantId(req), req.body)
    res.status(201).json({ agent })
  }),
  update: asyncHandler(async (req: Request, res: Response) => {
    res.json({ agent: await aiAgentsService.update(tenantId(req), req.params.id as string, req.body) })
  }),
  test: asyncHandler(async (req: Request, res: Response) => {
    res.json(await aiAgentsService.testConversation(tenantId(req), req.params.id as string, req.body))
  }),
}
