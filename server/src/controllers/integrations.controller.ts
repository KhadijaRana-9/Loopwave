import type { Request, Response } from 'express'
import { integrationsService } from '@/services/integrations.service.js'
import { asyncHandler } from '@/utils/asyncHandler.js'
import { ApiError } from '@/utils/apiError.js'

function tenantId(req: Request): string {
  if (!req.auth?.tenantId) throw ApiError.forbidden('No active workspace for this session')
  return req.auth.tenantId
}

export const integrationsController = {
  list: asyncHandler(async (req: Request, res: Response) => res.json({ integrations: await integrationsService.list(tenantId(req)) })),
  toggle: asyncHandler(async (req: Request, res: Response) => res.json(await integrationsService.toggle(tenantId(req), req.params.id as string))),
  saveConfig: asyncHandler(async (req: Request, res: Response) => res.json(await integrationsService.saveConfig(tenantId(req), req.params.id as string, req.body.config))),
  test: asyncHandler(async (req: Request, res: Response) => res.json(await integrationsService.testConnection(tenantId(req), req.params.id as string))),
}
