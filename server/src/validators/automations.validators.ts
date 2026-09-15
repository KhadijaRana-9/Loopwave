import { z } from 'zod'

export const automationIdParamSchema = z.object({ id: z.string().min(1) })

const positionSchema = z.object({ x: z.number(), y: z.number() })
const nodeSchema = z.object({ id: z.string().min(1), type: z.string().min(1), position: positionSchema, data: z.record(z.string(), z.unknown()).default({}) })
const edgeSchema = z.object({ id: z.string().min(1), source: z.string().min(1), target: z.string().min(1), label: z.string().optional() })

export const createAutomationSchema = z.object({
  name: z.string().trim().min(1).max(150),
  trigger: z.string().trim().default('new_contact'),
  nodes: z.array(nodeSchema).default([{ id: 'a1', type: 'trigger', position: { x: 0, y: 0 }, data: { label: 'Trigger' } }]),
  edges: z.array(edgeSchema).default([]),
})

export const updateAutomationSchema = z.object({
  name: z.string().trim().min(1).max(150).optional(),
  status: z.enum(['draft', 'active', 'paused']).optional(),
  trigger: z.string().trim().optional(),
  nodes: z.array(nodeSchema).optional(),
  edges: z.array(edgeSchema).optional(),
})
