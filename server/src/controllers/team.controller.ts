import type { Request, Response } from 'express'
import { teamService } from '@/services/team.service.js'
import { asyncHandler } from '@/utils/asyncHandler.js'
import { ApiError } from '@/utils/apiError.js'

function tenantId(req: Request): string {
  if (!req.auth?.tenantId) throw ApiError.forbidden('No active workspace for this session')
  return req.auth.tenantId
}

export const teamController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    res.json({ members: await teamService.list(tenantId(req)) })
  }),
  invite: asyncHandler(async (req: Request, res: Response) => {
    const member = await teamService.invite(tenantId(req), req.body)
    res.status(201).json({ member })
  }),
  updateRole: asyncHandler(async (req: Request, res: Response) => {
    const member = await teamService.updateRole(tenantId(req), req.params.id as string, req.body.role)
    res.json({ member })
  }),
  remove: asyncHandler(async (req: Request, res: Response) => {
    await teamService.remove(tenantId(req), req.params.id as string)
    res.status(204).send()
  }),
}
