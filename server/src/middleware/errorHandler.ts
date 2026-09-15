import type { NextFunction, Request, Response } from 'express'
import { ZodError } from 'zod'
import { Prisma } from '@prisma/client'
import { ApiError } from '@/utils/apiError.js'
import { isProduction } from '@/config/env.js'

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: `No route for ${req.method} ${req.path}` } })
}

// Centralized error translation: every layer throws ApiError, ZodError, or a
// Prisma error, and this is the only place that turns them into a response —
// controllers never format error JSON themselves.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ApiError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } })
  }

  if (err instanceof ZodError) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Some fields need your attention.',
        details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      },
    })
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: { code: 'CONFLICT', message: 'A record with these details already exists.' } })
    }
    if (err.code === 'P2025') {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Resource not found.' } })
    }
  }

  // body-parser throws a plain Error (not one of the above) for malformed
  // JSON/oversized bodies, with `.status`/`.statusCode` already set to the
  // right 4xx code — respect that instead of masking a client mistake as a 500.
  if (err instanceof Error && 'status' in err) {
    const status = (err as Error & { status?: unknown }).status
    if (typeof status === 'number' && status >= 400 && status < 500) {
      return res.status(status).json({ error: { code: 'BAD_REQUEST', message: 'The request body could not be parsed.' } })
    }
  }

  req.log?.error({ err }, 'Unhandled error')
  if (!isProduction) console.error(err)

  return res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: "We couldn't complete that request. Please try again." },
  })
}
