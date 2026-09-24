import { Router } from 'express'
import { notificationsController } from '@/controllers/notifications.controller.js'
import { validate } from '@/middleware/validate.js'
import { requireAuth, requireTenant } from '@/middleware/auth.js'
import { updateNotificationPreferencesSchema } from '@/validators/notifications.validators.js'

const router = Router()

router.use(requireAuth, requireTenant)

router.get('/', notificationsController.list)
router.patch('/:id/read', notificationsController.markRead)
router.post('/read-all', notificationsController.markAllRead)
router.get('/preferences', notificationsController.getPreferences)
router.patch('/preferences', validate({ body: updateNotificationPreferencesSchema }), notificationsController.updatePreferences)

export default router
