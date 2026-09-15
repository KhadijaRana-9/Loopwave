import { z } from 'zod'

export const chatbotIdParamSchema = z.object({ id: z.string().min(1) })

const positionSchema = z.object({ x: z.number(), y: z.number() })
const nodeSchema = z.object({ id: z.string().min(1), type: z.string().min(1), position: positionSchema, data: z.record(z.string(), z.unknown()).default({}) })
const edgeSchema = z.object({ id: z.string().min(1), source: z.string().min(1), target: z.string().min(1), label: z.string().optional() })

export const createChatbotSchema = z.object({
  name: z.string().trim().min(1).max(150),
  triggers: z.array(z.string().trim()).default([]),
  nodes: z.array(nodeSchema).default([{ id: 'n1', type: 'start', position: { x: 0, y: 0 }, data: { label: 'Start' } }]),
  edges: z.array(edgeSchema).default([]),
})

export const updateChatbotSchema = z.object({
  name: z.string().trim().min(1).max(150).optional(),
  status: z.enum(['draft', 'active', 'paused']).optional(),
  triggers: z.array(z.string().trim()).optional(),
  nodes: z.array(nodeSchema).optional(),
  edges: z.array(edgeSchema).optional(),
})
