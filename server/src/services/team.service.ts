import crypto from 'node:crypto'
import { teamRepository } from '@/repositories/team.repository.js'
import { assertUnderLimit } from '@/services/planLimits.service.js'
import { notifyUser } from '@/services/notifications.service.js'
import { sendEmail } from '@/integrations/email.adapter.js'
import { env } from '@/config/env.js'
import { ApiError } from '@/utils/apiError.js'
import { serializeTeamMember } from '@/utils/serializers.js'
import type { z } from 'zod'
import type { inviteTeamMemberSchema } from '@/validators/team.validators.js'

export const teamService = {
  async list(tenantId: string) {
    const members = await teamRepository.listMembers(tenantId)
    return members.map((m) => serializeTeamMember(m.user, m))
  },

  async invite(tenantId: string, input: z.infer<typeof inviteTeamMemberSchema>) {
    // Checked before the plan-limit gate below: re-inviting an existing
    // member should always say "already a member," never a confusing
    // "plan limit reached" just because they happen to be the Nth member.
    const existing = await teamRepository.findMembershipByUserEmail(tenantId, input.email)
    if (existing) throw ApiError.conflict('This person is already a member of your workspace.')

    const count = await teamRepository.count(tenantId)
    await assertUnderLimit(tenantId, 'teamMembers', count)

    const inviteToken = crypto.randomBytes(32).toString('hex')
    // Invited users get a random, unusable password hash — real access is
    // granted only once they set their own password via the invite link
    // below (server/src/services/auth.service.ts#acceptInvite), which also
    // activates the membership (it starts as INVITED, not ACTIVE — see
    // teamRepository.createInvite).
    const placeholderHash = crypto.randomBytes(32).toString('hex')
    const membership = await teamRepository.createInvite(tenantId, { ...input, passwordHash: placeholderHash, inviteToken })

    const emailResult = await sendEmail({
      to: input.email,
      subject: "You've been invited to a Loopwave workspace",
      body: `Hi ${input.name}, you've been invited to join a Loopwave workspace as ${input.role.toLowerCase().replace('_', ' ')}. Set your password to get started: ${env.WEB_APP_URL}/accept-invite?token=${inviteToken}`,
    })
    // The membership itself is real and already created either way — but a
    // genuine (non-demo) send failure here means the invitee never actually
    // got the email, which is worth a visible signal rather than a silent
    // swallow (they can still be invited again, or an admin can resend).
    if (!emailResult.sent && !emailResult.demo) {
      console.warn(`[team] invite email to ${input.email} failed to send (tenant ${tenantId})`)
    }

    return serializeTeamMember(membership.user, membership)
  },

  async updateRole(tenantId: string, userId: string, role: string) {
    const existing = await teamRepository.findMembershipByUserId(tenantId, userId)
    if (!existing) throw ApiError.notFound('Team member not found')
    if (existing.role === 'OWNER') throw ApiError.forbidden("The workspace owner's role can't be changed")
    const updated = await teamRepository.updateRole(tenantId, userId, role as never)
    await notifyUser(tenantId, updated.userId, { category: 'system', title: 'Your role was updated', body: `Your role is now ${role.toLowerCase().replace('_', ' ')}.` })
    return serializeTeamMember(updated.user, updated)
  },

  async remove(tenantId: string, userId: string) {
    const ok = await teamRepository.remove(tenantId, userId)
    if (!ok) throw ApiError.badRequest("This member can't be removed (not found, or is the workspace owner).")
  },
}
