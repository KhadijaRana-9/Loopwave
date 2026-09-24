import { Router } from 'express'
import { templatesController } from '@/controllers/templates.controller.js'
import { validate } from '@/middleware/validate.js'
import { requireAuth, requireTenant, requirePermission } from '@/middleware/auth.js'
import { PERMISSIONS } from '@/config/permissions.js'
import { createTemplateSchema, templateIdParamSchema, updateTemplateSchema } from '@/validators/templates.validators.js'

const router = Router()

router.use(requireAuth, requireTenant, requirePermission(PERMISSIONS.MANAGE_CAMPAIGNS))

router.get('/', templatesController.list)
router.post('/', validate({ body: createTemplateSchema }), templatesController.create)
router.post('/sync', templatesController.sync)
router.patch('/:id', validate({ params: templateIdParamSchema, body: updateTemplateSchema }), templatesController.update)
router.post('/:id/submit', validate({ params: templateIdParamSchema }), templatesController.submit)
router.delete('/:id', validate({ params: templateIdParamSchema }), templatesController.remove)

export default router
