import { Router } from 'express'
import { billingController } from '@/controllers/billing.controller.js'
import { validate } from '@/middleware/validate.js'
import { requireAuth, requireTenant, requirePermission } from '@/middleware/auth.js'
import { PERMISSIONS } from '@/config/permissions.js'
import { checkoutSchema } from '@/validators/billing.validators.js'

const router = Router()

// Provider webhook — no user session.
router.post('/webhook', billingController.webhook)

router.use(requireAuth, requireTenant, requirePermission(PERMISSIONS.MANAGE_BILLING))

router.get('/subscription', billingController.getSubscription)
router.get('/plans', billingController.listPlans)
router.get('/invoices', billingController.listInvoices)
router.get('/payment-method', billingController.paymentMethod)
router.post('/checkout', validate({ body: checkoutSchema }), billingController.checkout)
router.post('/cancel', billingController.cancel)
router.post('/resume', billingController.resume)

export default router
