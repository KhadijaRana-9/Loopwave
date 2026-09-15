import { Router } from 'express'
import { pipelineController } from '@/controllers/pipeline.controller.js'
import { validate } from '@/middleware/validate.js'
import { requireAuth, requireTenant, requirePermission } from '@/middleware/auth.js'
import { PERMISSIONS } from '@/config/permissions.js'
import { addDealNoteSchema, createDealSchema, dealIdParamSchema, updateDealSchema } from '@/validators/pipeline.validators.js'

const router = Router()

router.use(requireAuth, requireTenant, requirePermission(PERMISSIONS.MANAGE_PIPELINE))

router.get('/stages', pipelineController.listStages)
router.get('/deals', pipelineController.listDeals)
router.post('/deals', validate({ body: createDealSchema }), pipelineController.createDeal)
router.get('/deals/:id', validate({ params: dealIdParamSchema }), pipelineController.getDeal)
router.patch('/deals/:id', validate({ params: dealIdParamSchema, body: updateDealSchema }), pipelineController.updateDeal)
router.post('/deals/:id/notes', validate({ params: dealIdParamSchema, body: addDealNoteSchema }), pipelineController.addNote)

export default router
