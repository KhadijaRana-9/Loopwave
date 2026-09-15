import { Router } from 'express'
import { conversationsController } from '@/controllers/conversations.controller.js'
import { validate } from '@/middleware/validate.js'
import { requireAuth, requireTenant, requirePermission } from '@/middleware/auth.js'
import { PERMISSIONS } from '@/config/permissions.js'
import {
  addConversationNoteSchema,
  assignConversationSchema,
  conversationIdParamSchema,
  listConversationsQuerySchema,
  sendMessageSchema,
  updateConversationStatusSchema,
} from '@/validators/conversations.validators.js'

const router = Router()

router.use(requireAuth, requireTenant, requirePermission(PERMISSIONS.VIEW_INBOX))

router.get('/', validate({ query: listConversationsQuerySchema }), conversationsController.list)
router.get('/:id', validate({ params: conversationIdParamSchema }), conversationsController.get)
router.post(
  '/:id/messages',
  requirePermission(PERMISSIONS.REPLY_INBOX),
  validate({ params: conversationIdParamSchema, body: sendMessageSchema }),
  conversationsController.sendMessage,
)
router.patch(
  '/:id/assign',
  requirePermission(PERMISSIONS.ASSIGN_CONVERSATIONS),
  validate({ params: conversationIdParamSchema, body: assignConversationSchema }),
  conversationsController.assign,
)
router.patch(
  '/:id/status',
  requirePermission(PERMISSIONS.REPLY_INBOX),
  validate({ params: conversationIdParamSchema, body: updateConversationStatusSchema }),
  conversationsController.updateStatus,
)
router.post(
  '/:id/notes',
  requirePermission(PERMISSIONS.REPLY_INBOX),
  validate({ params: conversationIdParamSchema, body: addConversationNoteSchema }),
  conversationsController.addNote,
)

export default router
