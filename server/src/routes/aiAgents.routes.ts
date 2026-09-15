import { Router } from 'express'
import { aiAgentsController } from '@/controllers/aiAgents.controller.js'
import { validate } from '@/middleware/validate.js'
import { requireAuth, requireTenant, requirePermission } from '@/middleware/auth.js'
import { PERMISSIONS } from '@/config/permissions.js'
import { aiAgentIdParamSchema, createAiAgentSchema, testConversationSchema, updateAiAgentSchema } from '@/validators/aiAgents.validators.js'

const router = Router()

router.use(requireAuth, requireTenant, requirePermission(PERMISSIONS.MANAGE_AI_AGENTS))

router.get('/', aiAgentsController.list)
router.post('/', validate({ body: createAiAgentSchema }), aiAgentsController.create)
router.get('/:id', validate({ params: aiAgentIdParamSchema }), aiAgentsController.get)
router.patch('/:id', validate({ params: aiAgentIdParamSchema, body: updateAiAgentSchema }), aiAgentsController.update)
router.post('/:id/test', validate({ params: aiAgentIdParamSchema, body: testConversationSchema }), aiAgentsController.test)

export default router
