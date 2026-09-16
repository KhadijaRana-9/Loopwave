import { Router } from 'express'
import { contactsController } from '@/controllers/contacts.controller.js'
import { validate } from '@/middleware/validate.js'
import { requireAuth, requireTenant, requirePermission } from '@/middleware/auth.js'
import { PERMISSIONS } from '@/config/permissions.js'
import {
  addContactNoteSchema,
  bulkContactActionSchema,
  contactIdParamSchema,
  createContactSchema,
  listContactsQuerySchema,
  updateContactSchema,
} from '@/validators/contacts.validators.js'

const router = Router()

router.use(requireAuth, requireTenant)

router.get('/', requirePermission(PERMISSIONS.VIEW_CONTACTS), validate({ query: listContactsQuerySchema }), contactsController.list)
router.get('/facets', requirePermission(PERMISSIONS.VIEW_CONTACTS), contactsController.facets)
router.post('/', requirePermission(PERMISSIONS.EDIT_CONTACTS), validate({ body: createContactSchema }), contactsController.create)
router.post(
  '/bulk',
  requirePermission(PERMISSIONS.EDIT_CONTACTS),
  validate({ body: bulkContactActionSchema }),
  contactsController.bulkAction,
)
router.get('/:id', requirePermission(PERMISSIONS.VIEW_CONTACTS), validate({ params: contactIdParamSchema }), contactsController.get)
router.patch(
  '/:id',
  requirePermission(PERMISSIONS.EDIT_CONTACTS),
  validate({ params: contactIdParamSchema, body: updateContactSchema }),
  contactsController.update,
)
router.delete('/:id', requirePermission(PERMISSIONS.EDIT_CONTACTS), validate({ params: contactIdParamSchema }), contactsController.remove)
router.post(
  '/:id/notes',
  requirePermission(PERMISSIONS.EDIT_CONTACTS),
  validate({ params: contactIdParamSchema, body: addContactNoteSchema }),
  contactsController.addNote,
)

export default router
