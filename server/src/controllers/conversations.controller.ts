import type { Request, Response } from 'express'
import { conversationsService } from '@/services/conversations.service.js'
import { asyncHandler } from '@/utils/asyncHandler.js'
import { ApiError } from '@/utils/apiError.js'
import { getIo } from '@/websocket/io.js'
import type { ConversationStatus } from '@prisma/client'

function tenantId(req: Request): string {
  if (!req.auth?.tenantId) throw ApiError.forbidden('No active workspace for this session')
  return req.auth.tenantId
}

export const conversationsController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const { status, assignedAgentId, search } = req.query as { status?: string; assignedAgentId?: string; search?: string }
    const conversations = await conversationsService.list(tenantId(req), {
      status: status ? (status.toUpperCase() as ConversationStatus) : undefined,
      assignedAgentId,
      search,
    })
    res.json({ conversations })
  }),

  get: asyncHandler(async (req: Request, res: Response) => {
    res.json({ conversation: await conversationsService.getById(tenantId(req), req.params.id as string) })
  }),

  sendMessage: asyncHandler(async (req: Request, res: Response) => {
    const tId = tenantId(req)
    const message = await conversationsService.sendMessage(tId, req.params.id as string, req.body.text)
    getIo()?.to(`tenant:${tId}`).emit('conversation:message', { conversationId: req.params.id, message })
    res.status(201).json({ message })
  }),

  sendMedia: asyncHandler(async (req: Request, res: Response) => {
    const tId = tenantId(req)
    const file = (req as Request & { file?: Express.Multer.File }).file
    if (!file) throw ApiError.badRequest('No file uploaded')
    const message = await conversationsService.sendMedia(
      tId,
      req.params.id as string,
      { buffer: file.buffer, mimeType: file.mimetype, filename: file.originalname },
      typeof req.body.caption === 'string' && req.body.caption.trim() ? req.body.caption.trim() : undefined,
    )
    getIo()?.to(`tenant:${tId}`).emit('conversation:message', { conversationId: req.params.id, message })
    res.status(201).json({ message })
  }),

  // Redirects to a short-lived signed storage URL — never returns a
  // permanent one, and the tenant scope check happens inside the service.
  getMedia: asyncHandler(async (req: Request, res: Response) => {
    const url = await conversationsService.getMediaSignedUrl(tenantId(req), req.params.messageId as string)
    res.redirect(url)
  }),

  assign: asyncHandler(async (req: Request, res: Response) => {
    const conversation = await conversationsService.assign(tenantId(req), req.params.id as string, req.body.agentId)
    res.json({ conversation })
  }),

  updateStatus: asyncHandler(async (req: Request, res: Response) => {
    const conversation = await conversationsService.updateStatus(tenantId(req), req.params.id as string, req.body.status.toUpperCase())
    res.json({ conversation })
  }),

  addNote: asyncHandler(async (req: Request, res: Response) => {
    const note = await conversationsService.addNote(tenantId(req), req.params.id as string, req.auth?.sub, req.body.text)
    res.status(201).json({ note })
  }),
}
