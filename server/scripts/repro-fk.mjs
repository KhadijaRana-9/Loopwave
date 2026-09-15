import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({ log: ['warn', 'error'] })

function randomSuffix() {
  return Math.random().toString(36).slice(2, 10)
}

async function main() {
  const t0 = Date.now()
  const tenant = await prisma.tenant.create({
    data: { name: `Repro ${randomSuffix()}`, slug: `repro-${randomSuffix()}`, status: 'ACTIVE' },
  })
  console.log('tenant created in', Date.now() - t0, 'ms', tenant.id)

  const steps = ['contact', 'chatbot', 'aiAgent', 'template', 'automation', 'form']
  for (const step of steps) {
    const t1 = Date.now()
    try {
      if (step === 'contact') await prisma.contact.create({ data: { tenantId: tenant.id, name: 'X', phone: `+1${Date.now()}` } })
      if (step === 'chatbot') await prisma.chatbot.create({ data: { tenantId: tenant.id, name: 'X' } })
      if (step === 'aiAgent') await prisma.aIAgent.create({ data: { tenantId: tenant.id, name: 'X' } })
      if (step === 'template')
        await prisma.template.create({ data: { tenantId: tenant.id, name: `tpl_${randomSuffix()}`, category: 'utility', body: 'hi' } })
      if (step === 'automation') await prisma.automation.create({ data: { tenantId: tenant.id, name: 'X', trigger: 'new_contact' } })
      if (step === 'form') await prisma.form.create({ data: { tenantId: tenant.id, name: 'X' } })
      console.log(step, 'OK in', Date.now() - t1, 'ms')
    } catch (err) {
      console.log(step, 'FAILED in', Date.now() - t1, 'ms:', err.message)
    }
  }

  await prisma.tenant.delete({ where: { id: tenant.id } })
  console.log('cleaned up, total time', Date.now() - t0, 'ms')
}

main()
  .catch((e) => console.error('FATAL', e))
  .finally(() => prisma.$disconnect())
