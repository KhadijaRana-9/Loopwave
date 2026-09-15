import type { Request, Response } from 'express'
import { analyticsService } from '@/services/analytics.service.js'
import { asyncHandler } from '@/utils/asyncHandler.js'
import { ApiError } from '@/utils/apiError.js'

function tenantId(req: Request): string {
  if (!req.auth?.tenantId) throw ApiError.forbidden('No active workspace for this session')
  return req.auth.tenantId
}

function days(req: Request): number {
  const raw = Number(req.query.days)
  return Number.isFinite(raw) && raw > 0 ? Math.min(raw, 365) : 30
}

export const analyticsController = {
  messaging: asyncHandler(async (req: Request, res: Response) => res.json(await analyticsService.messaging(tenantId(req), days(req)))),
  campaigns: asyncHandler(async (req: Request, res: Response) => res.json(await analyticsService.campaigns(tenantId(req), days(req)))),
  contacts: asyncHandler(async (req: Request, res: Response) => res.json(await analyticsService.contacts(tenantId(req), days(req)))),
  leads: asyncHandler(async (req: Request, res: Response) => res.json(await analyticsService.leads(tenantId(req)))),
  conversion: asyncHandler(async (req: Request, res: Response) => res.json(await analyticsService.conversion(tenantId(req), days(req)))),
  agents: asyncHandler(async (req: Request, res: Response) => res.json(await analyticsService.agents(tenantId(req)))),
  aiUsage: asyncHandler(async (req: Request, res: Response) => res.json(await analyticsService.aiUsage(tenantId(req), days(req)))),
  automations: asyncHandler(async (req: Request, res: Response) => res.json(await analyticsService.automations(tenantId(req)))),
  whatsappUsage: asyncHandler(async (req: Request, res: Response) => res.json(await analyticsService.whatsappUsage(tenantId(req), days(req)))),
}
