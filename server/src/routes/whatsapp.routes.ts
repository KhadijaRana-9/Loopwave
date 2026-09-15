import { Router } from 'express'
import { whatsappController } from '@/controllers/whatsapp.controller.js'
import { validate } from '@/middleware/validate.js'
import { requireAuth, requireTenant, requirePermission } from '@/middleware/auth.js'
import { PERMISSIONS } from '@/config/permissions.js'
import { startSignupSchema, whatsappNumberIdParamSchema } from '@/validators/whatsapp.validators.js'

const router = Router()

// Meta calls these directly — no user session exists for a webhook request.
router.get('/webhook', whatsappController.verifyWebhook)
router.post('/webhook', whatsappController.receiveWebhook)

router.use(requireAuth, requireTenant, requirePermission(PERMISSIONS.MANAGE_WHATSAPP))

router.get('/numbers', whatsappController.listNumbers)
router.post('/connect', validate({ body: startSignupSchema }), whatsappController.startSignup)
router.post('/numbers/:id/disconnect', validate({ params: whatsappNumberIdParamSchema }), whatsappController.disconnect)

export default router
