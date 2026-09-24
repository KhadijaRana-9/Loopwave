import { z } from 'zod'

export const conversationIdParamSchema = z.object({ id: z.string().min(1) })

export const messageIdParamSchema = z.object({ messageId: z.string().min(1) })

export const listConversationsQuerySchema = z.object({
  status: z.enum(['open', 'pending', 'resolved']).optional(),
  assignedAgentId: z.string().trim().optional(),
  search: z.string().trim().max(200).optional(),
})

export const sendMessageSchema = z.object({ text: z.string().trim().min(1).max(4096) })

export const assignConversationSchema = z.object({ agentId: z.string().trim().nullable() })

export const updateConversationStatusSchema = z.object({ status: z.enum(['open', 'pending', 'resolved']) })

export const addConversationNoteSchema = z.object({ text: z.string().trim().min(1).max(2000) })
