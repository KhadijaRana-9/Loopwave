import { Router } from 'express'
import { tenantController } from '@/controllers/tenant.controller.js'
import { validate } from '@/middleware/validate.js'
import { requireAuth, requireTenant, requirePermission } from '@/middleware/auth.js'
import { PERMISSIONS } from '@/config/permissions.js'
import { updateTenantSchema } from '@/validators/tenant.validators.js'

const router = Router()

router.patch(
  '/me',
  requireAuth,
  requireTenant,
  requirePermission(PERMISSIONS.MANAGE_SETTINGS),
  validate({ body: updateTenantSchema }),
  tenantController.updateCurrent,
)

export default router
