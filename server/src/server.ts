import { createApp } from '@/app.js'
import { env } from '@/config/env.js'
import { prisma } from '@/config/prisma.js'
import { initIo } from '@/websocket/io.js'

const app = createApp()

const server = app.listen(env.PORT, () => {
  console.log(`Loopwave API listening on http://localhost:${env.PORT} (${env.NODE_ENV})`)
})

initIo(server)

async function shutdown(signal: string) {
  console.log(`${signal} received, shutting down...`)
  server.close(async () => {
    await prisma.$disconnect()
    process.exit(0)
  })
}

process.on('SIGINT', () => void shutdown('SIGINT'))
process.on('SIGTERM', () => void shutdown('SIGTERM'))
