import { Router } from 'express'
import { chatbotsController } from '@/controllers/chatbots.controller.js'
import { validate } from '@/middleware/validate.js'
import { requireAuth, requireTenant, requirePermission } from '@/middleware/auth.js'
import { PERMISSIONS } from '@/config/permissions.js'
import { chatbotIdParamSchema, createChatbotSchema, updateChatbotSchema } from '@/validators/chatbots.validators.js'

const router = Router()

router.use(requireAuth, requireTenant, requirePermission(PERMISSIONS.MANAGE_CHATBOT))

router.get('/', chatbotsController.list)
router.post('/', validate({ body: createChatbotSchema }), chatbotsController.create)
router.get('/:id', validate({ params: chatbotIdParamSchema }), chatbotsController.get)
router.patch('/:id', validate({ params: chatbotIdParamSchema, body: updateChatbotSchema }), chatbotsController.update)
router.delete('/:id', validate({ params: chatbotIdParamSchema }), chatbotsController.remove)

export default router
