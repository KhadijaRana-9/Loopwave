import { Router } from 'express'
import { integrationsController } from '@/controllers/integrations.controller.js'
import { validate } from '@/middleware/validate.js'
import { requireAuth, requireTenant, requirePermission } from '@/middleware/auth.js'
import { PERMISSIONS } from '@/config/permissions.js'
import { integrationIdParamSchema, saveIntegrationConfigSchema } from '@/validators/integrations.validators.js'

const router = Router()

router.use(requireAuth, requireTenant, requirePermission(PERMISSIONS.MANAGE_INTEGRATIONS))

router.get('/', integrationsController.list)
router.post('/:id/toggle', validate({ params: integrationIdParamSchema }), integrationsController.toggle)
router.post('/:id/config', validate({ params: integrationIdParamSchema, body: saveIntegrationConfigSchema }), integrationsController.saveConfig)
router.post('/:id/test', validate({ params: integrationIdParamSchema }), integrationsController.test)

export default router
