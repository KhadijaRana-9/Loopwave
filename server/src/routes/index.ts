import { Router } from 'express'
import authRoutes from './auth.routes.js'
import tenantRoutes from './tenant.routes.js'
import contactsRoutes from './contacts.routes.js'
import healthRoutes from './health.routes.js'
import pipelineRoutes from './pipeline.routes.js'
import conversationsRoutes from './conversations.routes.js'
import templatesRoutes from './templates.routes.js'
import campaignsRoutes from './campaigns.routes.js'
import teamRoutes from './team.routes.js'
import notificationsRoutes from './notifications.routes.js'
import chatbotsRoutes from './chatbots.routes.js'
import automationsRoutes from './automations.routes.js'
import aiAgentsRoutes from './aiAgents.routes.js'
import formsRoutes from './forms.routes.js'
import whatsappRoutes from './whatsapp.routes.js'
import integrationsRoutes from './integrations.routes.js'
import billingRoutes from './billing.routes.js'
import analyticsRoutes from './analytics.routes.js'
import adminRoutes from './admin.routes.js'

const router = Router()

router.use('/', healthRoutes)
router.use('/auth', authRoutes)
router.use('/tenant', tenantRoutes)
router.use('/contacts', contactsRoutes)
router.use('/pipeline', pipelineRoutes)
router.use('/conversations', conversationsRoutes)
router.use('/templates', templatesRoutes)
router.use('/campaigns', campaignsRoutes)
router.use('/team', teamRoutes)
router.use('/notifications', notificationsRoutes)
router.use('/chatbots', chatbotsRoutes)
router.use('/automations', automationsRoutes)
router.use('/ai-agents', aiAgentsRoutes)
router.use('/forms', formsRoutes)
router.use('/whatsapp', whatsappRoutes)
router.use('/integrations', integrationsRoutes)
router.use('/billing', billingRoutes)
router.use('/analytics', analyticsRoutes)
router.use('/admin', adminRoutes)

export default router
