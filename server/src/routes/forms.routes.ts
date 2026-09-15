import { Router } from 'express'
import { formsController } from '@/controllers/forms.controller.js'
import { validate } from '@/middleware/validate.js'
import { requireAuth, requireTenant, requirePermission } from '@/middleware/auth.js'
import { PERMISSIONS } from '@/config/permissions.js'
import { createFormSchema, formIdParamSchema, submitFormSchema, updateFormSchema } from '@/validators/forms.validators.js'

const router = Router()

// Public submission endpoint — no auth, deliberately mounted before the
// requireAuth gate below so an embedded form can post from any visitor's browser.
router.post('/:id/submit', validate({ params: formIdParamSchema, body: submitFormSchema }), formsController.submitPublic)

router.use(requireAuth, requireTenant, requirePermission(PERMISSIONS.MANAGE_FORMS))

router.get('/', formsController.list)
router.post('/', validate({ body: createFormSchema }), formsController.create)
router.patch('/:id', validate({ params: formIdParamSchema, body: updateFormSchema }), formsController.update)
router.delete('/:id', validate({ params: formIdParamSchema }), formsController.remove)
router.get('/:id/submissions', validate({ params: formIdParamSchema }), formsController.submissions)

export default router
