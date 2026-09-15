import { Router } from 'express'
import { teamController } from '@/controllers/team.controller.js'
import { validate } from '@/middleware/validate.js'
import { requireAuth, requireTenant, requirePermission } from '@/middleware/auth.js'
import { PERMISSIONS } from '@/config/permissions.js'
import { inviteTeamMemberSchema, membershipIdParamSchema, updateRoleSchema } from '@/validators/team.validators.js'

const router = Router()

router.use(requireAuth, requireTenant, requirePermission(PERMISSIONS.MANAGE_TEAM))

router.get('/', teamController.list)
router.post('/', validate({ body: inviteTeamMemberSchema }), teamController.invite)
router.patch('/:id/role', validate({ params: membershipIdParamSchema, body: updateRoleSchema }), teamController.updateRole)
router.delete('/:id', validate({ params: membershipIdParamSchema }), teamController.remove)

export default router
