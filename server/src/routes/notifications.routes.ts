import { Router } from 'express'
import { notificationsController } from '@/controllers/notifications.controller.js'
import { requireAuth, requireTenant } from '@/middleware/auth.js'

const router = Router()

router.use(requireAuth, requireTenant)

router.get('/', notificationsController.list)
router.patch('/:id/read', notificationsController.markRead)
router.post('/read-all', notificationsController.markAllRead)

export default router
