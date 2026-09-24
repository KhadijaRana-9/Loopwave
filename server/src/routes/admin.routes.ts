import { Router } from 'express'
import { adminController } from '@/controllers/admin.controller.js'
import { validate } from '@/middleware/validate.js'
import { requireAuth, requireSuperAdmin } from '@/middleware/auth.js'
import { createPlanSchema, planIdParamSchema, setTenantStatusSchema, tenantIdParamSchema, updatePlanSchema, updatePlatformSettingsSchema } from '@/validators/admin.validators.js'

const router = Router()

router.use(requireAuth, requireSuperAdmin)

router.get('/tenants', adminController.listTenants)
router.patch('/tenants/:id/status', validate({ params: tenantIdParamSchema, body: setTenantStatusSchema }), adminController.setTenantStatus)
router.get('/dashboard', adminController.dashboard)
router.get('/users', adminController.listUsers)
router.get('/plans', adminController.listPlans)
router.patch('/plans/:id', validate({ params: planIdParamSchema, body: updatePlanSchema }), adminController.updatePlan)
router.post('/plans', validate({ body: createPlanSchema }), adminController.createPlan)
router.get('/settings', adminController.getSettings)
router.patch('/settings', validate({ body: updatePlatformSettingsSchema }), adminController.updateSettings)
router.get('/system-logs', adminController.systemLogs)
router.get('/tenants/:id/usage', validate({ params: tenantIdParamSchema }), adminController.tenantUsage)
router.get('/ai-agents', adminController.aiAgents)
router.get('/campaigns', adminController.campaigns)

export default router
