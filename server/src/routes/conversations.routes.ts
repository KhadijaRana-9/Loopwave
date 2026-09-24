import { Router } from 'express'
import multer from 'multer'
import { conversationsController } from '@/controllers/conversations.controller.js'
import { validate } from '@/middleware/validate.js'
import { requireAuth, requireTenant, requirePermission } from '@/middleware/auth.js'
import { PERMISSIONS } from '@/config/permissions.js'
import {
  addConversationNoteSchema,
  assignConversationSchema,
  conversationIdParamSchema,
  listConversationsQuerySchema,
  messageIdParamSchema,
  sendMessageSchema,
  updateConversationStatusSchema,
} from '@/validators/conversations.validators.js'

// Memory storage — files are validated (type/size) and forwarded straight to
// Meta + our own object storage, never written to local disk. The 100MB cap
// matches the largest Meta-allowed media type (documents); the real
// per-type limits are enforced in mediaLimits.ts after this.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } })

const router = Router()

router.use(requireAuth, requireTenant, requirePermission(PERMISSIONS.VIEW_INBOX))

router.get('/', validate({ query: listConversationsQuerySchema }), conversationsController.list)
// Must come before '/:id' — otherwise Express would match "media" as an :id.
router.get('/media/:messageId', validate({ params: messageIdParamSchema }), conversationsController.getMedia)
router.get('/:id', validate({ params: conversationIdParamSchema }), conversationsController.get)
router.post(
  '/:id/messages',
  requirePermission(PERMISSIONS.REPLY_INBOX),
  validate({ params: conversationIdParamSchema, body: sendMessageSchema }),
  conversationsController.sendMessage,
)
router.post(
  '/:id/messages/media',
  requirePermission(PERMISSIONS.REPLY_INBOX),
  validate({ params: conversationIdParamSchema }),
  upload.single('file'),
  conversationsController.sendMedia,
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
