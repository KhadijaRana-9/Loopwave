import 'dotenv/config'
import { authService } from '../src/services/auth.service.ts'
import { chatbotsService } from '../src/services/chatbots.service.ts'
import { prisma } from '../src/config/prisma.ts'

function randomSuffix() {
  return Math.random().toString(36).slice(2, 10)
}

async function main() {
  const email = `repro-${randomSuffix()}@test.loopwave.internal`
  const result = await authService.signup({ name: 'Repro', email, password: 'TestPass123', workspaceName: `Repro WS ${randomSuffix()}` })
  console.log('signup tenant id:', result.tenant.id)

  const bot = await chatbotsService.create(result.tenant.id, { name: 'Repro Bot', triggers: [], nodes: [{ id: 'n1', type: 'start', position: { x: 0, y: 0 }, data: {} }], edges: [] })
  console.log('chatbot created:', bot.id)

  await prisma.tenant.delete({ where: { id: result.tenant.id } })
  await prisma.user.delete({ where: { id: result.user.id } })
  console.log('cleaned up OK')
}

main()
  .catch((e) => console.error('FATAL', e))
  .finally(() => prisma.$disconnect())
