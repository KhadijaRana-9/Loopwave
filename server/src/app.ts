import express from 'express'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import helmet from 'helmet'
import { pinoHttp } from 'pino-http'
import crypto from 'node:crypto'
import type { IncomingMessage } from 'node:http'
import { env } from '@/config/env.js'
import routes from '@/routes/index.js'
import { errorHandler, notFoundHandler } from '@/middleware/errorHandler.js'
import { apiRateLimit } from '@/middleware/rateLimit.js'

export function createApp() {
  const app = express()

  app.set('trust proxy', 1)
  app.use(helmet())
  app.use(
    cors({
      origin: env.WEB_APP_URL,
      credentials: true,
    }),
  )
  app.use(
    pinoHttp({
      genReqId: () => crypto.randomUUID(),
      autoLogging: { ignore: (req: IncomingMessage) => req.url === '/api/health' },
      // Deliberately lean: pino-http's defaults serialize every request/response
      // header verbatim (including the full CSP policy string) on every single
      // request, which is noisy, risks leaking secrets despite redact rules,
      // and under sustained load measurably slows request handling — logging
      // is meant to observe the system, not become its bottleneck.
      serializers: {
        req: (req) => ({ id: req.id, method: req.method, url: req.url }),
        res: (res) => ({ statusCode: res.statusCode }),
      },
    }),
  )
  app.use(
    express.json({
      limit: '1mb',
      // Preserved so webhook handlers (WhatsApp, Stripe, Razorpay) can verify
      // provider signatures against the exact bytes that were sent, not a
      // re-serialized copy that might not match byte-for-byte.
      verify: (req, _res, buf) => {
        ;(req as express.Request & { rawBody?: Buffer }).rawBody = buf
      },
    }),
  )
  app.use(cookieParser())
  app.use(apiRateLimit)

  app.use('/api', routes)

  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}
