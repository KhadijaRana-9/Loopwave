import type { Request, Response } from 'express'
import { prisma } from '@/config/prisma.js'
import { asyncHandler } from '@/utils/asyncHandler.js'
import { ApiError } from '@/utils/apiError.js'
import { serializeTenant } from '@/utils/serializers.js'

export const tenantController = {
  updateCurrent: asyncHandler(async (req: Request, res: Response) => {
    if (!req.auth?.tenantId) throw ApiError.forbidden('No active workspace for this session')
    const tenant = await prisma.tenant.update({
      where: { id: req.auth.tenantId },
      data: { name: req.body.name },
      include: { subscription: true },
    })
    res.json({ tenant: serializeTenant(tenant) })
  }),
}
