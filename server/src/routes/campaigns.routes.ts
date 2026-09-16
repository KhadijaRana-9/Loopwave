import { Router } from 'express'
import { campaignsController } from '@/controllers/campaigns.controller.js'
import { validate } from '@/middleware/validate.js'
import { requireAuth, requireTenant, requirePermission } from '@/middleware/auth.js'
import { PERMISSIONS } from '@/config/permissions.js'
import { campaignIdParamSchema, createCampaignSchema, campaignComposeSchema, audiencePreviewSchema } from '@/validators/campaigns.validators.js'

const router = Router()

router.use(requireAuth, requireTenant, requirePermission(PERMISSIONS.MANAGE_CAMPAIGNS))

router.get('/', campaignsController.list)
router.post('/', requirePermission(PERMISSIONS.SEND_CAMPAIGNS), validate({ body: createCampaignSchema }), campaignsController.create)
router.post('/ai/compose', validate({ body: campaignComposeSchema }), campaignsController.compose)
router.post('/audience/preview', validate({ body: audiencePreviewSchema }), campaignsController.previewAudience)
router.get('/:id', validate({ params: campaignIdParamSchema }), campaignsController.get)
router.post('/:id/duplicate', validate({ params: campaignIdParamSchema }), campaignsController.duplicate)
router.post('/:id/cancel', validate({ params: campaignIdParamSchema }), campaignsController.cancel)

export default router
