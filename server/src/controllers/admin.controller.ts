import type { Request, Response } from 'express'
import { adminService } from '@/services/admin.service.js'
import { asyncHandler } from '@/utils/asyncHandler.js'

export const adminController = {
  listTenants: asyncHandler(async (_req: Request, res: Response) => res.json({ tenants: await adminService.listTenants() })),
  setTenantStatus: asyncHandler(async (req: Request, res: Response) => {
    const tenant = await adminService.setTenantStatus(req.params.id as string, req.body.status, req.auth!.sub)
    res.json({ tenant })
  }),
  dashboard: asyncHandler(async (_req: Request, res: Response) => res.json(await adminService.getPlatformDashboard())),
  listUsers: asyncHandler(async (_req: Request, res: Response) => res.json({ users: await adminService.listPlatformUsers() })),
  listPlans: asyncHandler(async (_req: Request, res: Response) => res.json({ plans: await adminService.listPlans() })),
  updatePlan: asyncHandler(async (req: Request, res: Response) => res.json({ plan: await adminService.updatePlan(req.params.id as string, req.body) })),
  createPlan: asyncHandler(async (req: Request, res: Response) => {
    const plan = await adminService.createPlan(req.body)
    res.status(201).json({ plan })
  }),
  getSettings: asyncHandler(async (_req: Request, res: Response) => res.json({ settings: await adminService.getSettings() })),
  updateSettings: asyncHandler(async (req: Request, res: Response) => res.json({ settings: await adminService.updateSettings(req.body) })),
  systemLogs: asyncHandler(async (_req: Request, res: Response) => res.json({ logs: await adminService.listSystemLogs() })),
  tenantUsage: asyncHandler(async (req: Request, res: Response) => res.json(await adminService.getTenantUsage(req.params.id as string))),
  aiAgents: asyncHandler(async (_req: Request, res: Response) => res.json({ agents: await adminService.listAiAgentsAcrossTenants() })),
  campaigns: asyncHandler(async (_req: Request, res: Response) => res.json({ campaigns: await adminService.listCampaignsAcrossTenants() })),
}
