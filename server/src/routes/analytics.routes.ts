import { Router } from 'express'
import { analyticsController } from '@/controllers/analytics.controller.js'
import { requireAuth, requireTenant, requirePermission } from '@/middleware/auth.js'
import { PERMISSIONS } from '@/config/permissions.js'

const router = Router()

router.use(requireAuth, requireTenant, requirePermission(PERMISSIONS.VIEW_ANALYTICS))

router.get('/messaging', analyticsController.messaging)
router.get('/campaigns', analyticsController.campaigns)
router.get('/contacts', analyticsController.contacts)
router.get('/leads', analyticsController.leads)
router.get('/conversion', analyticsController.conversion)
router.get('/agents', analyticsController.agents)
router.get('/ai-usage', analyticsController.aiUsage)
router.get('/automations', analyticsController.automations)
router.get('/whatsapp-usage', analyticsController.whatsappUsage)

export default router
