import { Router } from 'express'
import { automationsController } from '@/controllers/automations.controller.js'
import { validate } from '@/middleware/validate.js'
import { requireAuth, requireTenant, requirePermission } from '@/middleware/auth.js'
import { PERMISSIONS } from '@/config/permissions.js'
import { automationIdParamSchema, createAutomationSchema, updateAutomationSchema } from '@/validators/automations.validators.js'

const router = Router()

router.use(requireAuth, requireTenant, requirePermission(PERMISSIONS.MANAGE_AUTOMATIONS))

router.get('/', automationsController.list)
router.post('/', validate({ body: createAutomationSchema }), automationsController.create)
router.get('/:id', validate({ params: automationIdParamSchema }), automationsController.get)
router.patch('/:id', validate({ params: automationIdParamSchema, body: updateAutomationSchema }), automationsController.update)
router.post('/:id/toggle', validate({ params: automationIdParamSchema }), automationsController.toggle)
router.post('/:id/test', validate({ params: automationIdParamSchema }), automationsController.test)
router.get('/:id/executions', validate({ params: automationIdParamSchema }), automationsController.executions)

export default router
