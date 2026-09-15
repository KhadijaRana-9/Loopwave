import { Router } from 'express'
import { authController } from '@/controllers/auth.controller.js'
import { validate } from '@/middleware/validate.js'
import { requireAuth } from '@/middleware/auth.js'
import { authRateLimit } from '@/middleware/rateLimit.js'
import { z } from 'zod'
import { acceptInviteSchema, adminLoginSchema, loginSchema, signupSchema, updateProfileSchema } from '@/validators/auth.validators.js'

const router = Router()

router.post('/signup', authRateLimit, validate({ body: signupSchema }), authController.signup)
router.post('/login', authRateLimit, validate({ body: loginSchema }), authController.login)
router.post('/admin-login', authRateLimit, validate({ body: adminLoginSchema }), authController.adminLogin)
router.get('/invite', validate({ query: z.object({ token: z.string().min(1) }) }), authController.checkInvite)
router.post('/accept-invite', authRateLimit, validate({ body: acceptInviteSchema }), authController.acceptInvite)
router.post('/refresh', authController.refresh)
router.post('/logout', authController.logout)
router.get('/me', requireAuth, authController.me)
router.patch('/me', requireAuth, validate({ body: updateProfileSchema }), authController.updateProfile)

export default router
