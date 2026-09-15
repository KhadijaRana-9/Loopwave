import { PrismaClient, LeadStatus } from '@prisma/client'
import { hashPassword } from '../src/utils/password.js'

const prisma = new PrismaClient()

// Mirrors src/constants/plans.js (PLANS) on the frontend so Super Admin's
// plan editor and the tenant-facing billing/usage screens read the same
// records whether the data comes from this seed or a later production edit.
const PLANS = [
  {
    id: 'trial', name: 'Free Trial', tagline: '14 days, full feature taste', price: 0, isTrial: true,
    limits: { whatsappNumbers: 1, teamMembers: 2, contacts: 500, monthlyConversations: 250, monthlyMarketingMessages: 250, chatbotFlows: 1, aiUsage: 100, automationWorkflows: 2, storageGb: 1, analyticsHistoryDays: 7, integrations: 1 },
  },
  {
    id: 'starter', name: 'Starter', tagline: 'For small teams getting started on WhatsApp', price: 999,
    limits: { whatsappNumbers: 1, teamMembers: 3, contacts: 2500, monthlyConversations: 1000, monthlyMarketingMessages: 2000, chatbotFlows: 3, aiUsage: 500, automationWorkflows: 5, storageGb: 5, analyticsHistoryDays: 30, integrations: 3 },
  },
  {
    id: 'pro', name: 'Pro', tagline: 'Growing teams running campaigns at scale', price: 2999,
    limits: { whatsappNumbers: 3, teamMembers: 10, contacts: 15000, monthlyConversations: 8000, monthlyMarketingMessages: 20000, chatbotFlows: 10, aiUsage: 3000, automationWorkflows: 20, storageGb: 25, analyticsHistoryDays: 90, integrations: 10 },
  },
  {
    id: 'business', name: 'Business', tagline: 'Multi-agent teams with heavy automation needs', price: 7999,
    limits: { whatsappNumbers: 10, teamMembers: 40, contacts: 100000, monthlyConversations: 40000, monthlyMarketingMessages: 100000, chatbotFlows: 40, aiUsage: 15000, automationWorkflows: 100, storageGb: 100, analyticsHistoryDays: 180, integrations: 25 },
  },
  {
    id: 'enterprise', name: 'Enterprise', tagline: 'Custom limits, SLAs and dedicated support', price: null, billingCycle: 'custom',
    limits: { whatsappNumbers: -1, teamMembers: -1, contacts: -1, monthlyConversations: -1, monthlyMarketingMessages: -1, chatbotFlows: -1, aiUsage: -1, automationWorkflows: -1, storageGb: -1, analyticsHistoryDays: -1, integrations: -1 },
  },
]

const FIRST_NAMES = ['Sara', 'Omar', 'Liu', 'Nadia', 'Carlos', 'Emeka', 'Yuki', 'Ivan', 'Grace', 'Ahmed', 'Lena', 'Raj']
const LAST_NAMES = ['Khan', 'Fischer', 'Wang', 'Silva', 'Osei', 'Tanaka', 'Petrov', 'Adeyemi', 'Novak', 'Iqbal']
const SOURCES = ['WhatsApp Ad', 'Website Form', 'Manual Import', 'Referral', 'Chatbot', 'Instagram']
const LEAD_STATUSES: LeadStatus[] = ['NEW', 'QUALIFIED', 'CONTACTED', 'INTERESTED', 'DEMO_BOOKED', 'CONVERTED', 'LOST']

async function main() {
  console.log('Seeding Loopwave database...')

  for (const plan of PLANS) {
    await prisma.plan.upsert({
      where: { id: plan.id },
      create: { ...plan, billingCycle: plan.billingCycle ?? 'monthly' },
      update: { ...plan, billingCycle: plan.billingCycle ?? 'monthly' },
    })
  }

  // --- Platform Super Admin ---
  const superAdminPassword = process.env.SEED_SUPER_ADMIN_PASSWORD ?? 'ChangeMe123!'
  await prisma.user.upsert({
    where: { email: 'admin@loopwave.internal' },
    create: {
      name: 'Platform Admin',
      email: 'admin@loopwave.internal',
      passwordHash: await hashPassword(superAdminPassword),
      platformRole: 'SUPER_ADMIN',
      avatarColor: '#181d2a',
    },
    update: {},
  })
  console.log(`Super admin: admin@loopwave.internal / ${superAdminPassword} (change via SEED_SUPER_ADMIN_PASSWORD)`)

  // --- Demo tenant: Loopwave Demo Business ---
  const demoPassword = process.env.SEED_DEMO_PASSWORD ?? 'Demo1234!'
  const owner = await prisma.user.upsert({
    where: { email: 'aisha@loopwavedemo.com' },
    create: { name: 'Aisha Rahman', email: 'aisha@loopwavedemo.com', passwordHash: await hashPassword(demoPassword), avatarColor: '#4a63f7' },
    update: {},
  })

  const tenant = await prisma.tenant.upsert({
    where: { slug: 'loopwave-demo' },
    create: { name: 'Loopwave Demo Business', slug: 'loopwave-demo', status: 'ACTIVE' },
    update: {},
  })

  await prisma.membership.upsert({
    where: { tenantId_userId: { tenantId: tenant.id, userId: owner.id } },
    create: { tenantId: tenant.id, userId: owner.id, role: 'OWNER', status: 'ACTIVE' },
    update: {},
  })

  await prisma.subscription.upsert({
    where: { tenantId: tenant.id },
    create: { tenantId: tenant.id, planId: 'pro', status: 'ACTIVE', currentPeriodEnd: new Date(Date.now() + 30 * 86_400_000) },
    update: {},
  })

  const teammates = [
    { name: 'Daniel Cho', email: 'daniel@loopwavedemo.com', role: 'ADMIN' as const },
    { name: 'Priya Nair', email: 'priya@loopwavedemo.com', role: 'MANAGER' as const },
    { name: 'Marcus Lee', email: 'marcus@loopwavedemo.com', role: 'SALES_AGENT' as const },
    { name: 'Fatima Al-Sayed', email: 'fatima@loopwavedemo.com', role: 'SUPPORT_AGENT' as const },
    { name: 'Tom Becker', email: 'tom@loopwavedemo.com', role: 'VIEWER' as const },
  ]
  const teamUsers = [owner]
  for (const mate of teammates) {
    const u = await prisma.user.upsert({
      where: { email: mate.email },
      create: { name: mate.name, email: mate.email, passwordHash: await hashPassword(demoPassword) },
      update: {},
    })
    await prisma.membership.upsert({
      where: { tenantId_userId: { tenantId: tenant.id, userId: u.id } },
      create: { tenantId: tenant.id, userId: u.id, role: mate.role, status: 'ACTIVE' },
      update: {},
    })
    teamUsers.push(u)
  }

  // --- Pipeline ---
  let pipeline = await prisma.pipeline.findFirst({ where: { tenantId: tenant.id, isDefault: true } })
  if (!pipeline) pipeline = await prisma.pipeline.create({ data: { tenantId: tenant.id, name: 'Default Pipeline', isDefault: true } })
  const stageDefs = [
    { key: 'new', label: 'New' }, { key: 'qualified', label: 'Qualified' }, { key: 'contacted', label: 'Contacted' },
    { key: 'interested', label: 'Interested' }, { key: 'demo_booked', label: 'Demo Booked' },
    { key: 'converted', label: 'Converted' }, { key: 'lost', label: 'Lost' },
  ]
  const stages = []
  for (let i = 0; i < stageDefs.length; i++) {
    const s = await prisma.pipelineStage.upsert({
      where: { pipelineId_key: { pipelineId: pipeline.id, key: stageDefs[i]!.key } },
      create: { pipelineId: pipeline.id, key: stageDefs[i]!.key, label: stageDefs[i]!.label, order: i },
      update: {},
    })
    stages.push(s)
  }

  // --- Contacts ---
  const contacts = []
  for (let i = 0; i < 24; i++) {
    const first = FIRST_NAMES[i % FIRST_NAMES.length]!
    const last = LAST_NAMES[(i * 3) % LAST_NAMES.length]!
    const phone = `+9198765${String(10000 + i).slice(-5)}`
    const contact = await prisma.contact.upsert({
      where: { tenantId_phone: { tenantId: tenant.id, phone } },
      create: {
        tenantId: tenant.id,
        name: `${first} ${last}`,
        phone,
        email: `${first.toLowerCase()}.${last.toLowerCase()}@example.com`,
        company: i % 4 === 0 ? `${last} Textiles` : i % 4 === 1 ? `${last} Retail Co.` : i % 4 === 2 ? `${last} Logistics` : null,
        source: SOURCES[i % SOURCES.length],
        leadStatus: LEAD_STATUSES[i % LEAD_STATUSES.length],
        leadScore: 30 + ((i * 17) % 70),
        assignedAgentId: teamUsers[(i % 4) + 1]!.id,
        customFields: { industry: i % 2 === 0 ? 'Retail' : 'Manufacturing' },
        lastInteractionAt: new Date(Date.now() - i * 3600 * 1000 * 5),
      },
      update: {},
    })
    contacts.push(contact)
  }

  // --- Deals ---
  for (let i = 0; i < 18; i++) {
    const contact = contacts[i]!
    const stage = stages[i % stages.length]!
    const existing = await prisma.deal.findFirst({ where: { tenantId: tenant.id, contactId: contact.id } })
    if (!existing) {
      await prisma.deal.create({
        data: {
          tenantId: tenant.id,
          pipelineId: pipeline.id,
          stageId: stage.id,
          contactId: contact.id,
          title: `${contact.company ?? contact.name} — subscription`,
          value: 999 * (1 + (i % 8)),
          assignedAgentId: contact.assignedAgentId,
        },
      })
    }
  }

  // --- Templates ---
  const templateDefs = [
    { name: 'welcome_message', category: 'utility', status: 'APPROVED' as const, body: 'Hi {{1}}, welcome to Loopwave! Reply STOP to opt out.', variables: ['name'] },
    { name: 'order_confirmation', category: 'utility', status: 'APPROVED' as const, body: 'Your order {{1}} has been confirmed and will arrive by {{2}}.', variables: ['order_id', 'eta'] },
    { name: 'flash_sale_promo', category: 'marketing', status: 'APPROVED' as const, body: 'Flash Sale! Get {{1}}% off on {{2}} — today only.', variables: ['discount', 'category'] },
    { name: 'abandoned_cart', category: 'marketing', status: 'PENDING' as const, body: 'Hi {{1}}, you left {{2}} in your cart. Complete your order now!', variables: ['name', 'item'] },
    { name: 'otp_login', category: 'authentication', status: 'APPROVED' as const, body: 'Your Loopwave verification code is {{1}}. Valid for 5 minutes.', variables: ['otp'] },
  ]
  const templates = []
  for (const t of templateDefs) {
    const template = await prisma.template.upsert({
      where: { tenantId_name_language: { tenantId: tenant.id, name: t.name, language: 'en_US' } },
      create: { tenantId: tenant.id, name: t.name, category: t.category, status: t.status, body: t.body, variables: t.variables },
      update: {},
    })
    templates.push(template)
  }

  // --- Campaigns ---
  const campaignDefs = [
    { name: 'Diwali Flash Sale', templateIdx: 2, status: 'COMPLETED' as const },
    { name: 'Cart Recovery — August', templateIdx: 3, status: 'RUNNING' as const },
    { name: 'New Collection Launch', templateIdx: 2, status: 'SCHEDULED' as const },
  ]
  for (const c of campaignDefs) {
    const existing = await prisma.campaign.findFirst({ where: { tenantId: tenant.id, name: c.name } })
    if (!existing) {
      await prisma.campaign.create({
        data: { tenantId: tenant.id, name: c.name, templateId: templates[c.templateIdx]!.id, status: c.status },
      })
    }
  }

  // --- Conversations + messages ---
  for (let i = 0; i < 16; i++) {
    const contact = contacts[i]!
    let conversation = await prisma.conversation.findFirst({ where: { tenantId: tenant.id, contactId: contact.id } })
    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          tenantId: tenant.id,
          contactId: contact.id,
          status: i % 5 === 0 ? 'RESOLVED' : i % 3 === 0 ? 'PENDING' : 'OPEN',
          priority: i % 4 === 0 ? 'HIGH' : 'NORMAL',
          unreadCount: i % 3 === 0 ? 1 + (i % 3) : 0,
          lastMessageAt: new Date(),
        },
      })
      const messageCount = 3 + (i % 4)
      for (let m = 0; m < messageCount; m++) {
        const inbound = m % 2 === 0
        await prisma.message.create({
          data: {
            conversationId: conversation.id,
            direction: inbound ? 'INBOUND' : 'OUTBOUND',
            text: inbound ? 'Hi, I saw your ad and I am interested in learning more.' : 'Hi! Thanks for reaching out. How can we help today?',
            status: inbound ? 'RECEIVED' : 'DELIVERED',
            createdAt: new Date(Date.now() - (messageCount - m) * 900 * 1000),
          },
        })
      }
    }
  }

  // --- Chatbots ---
  const existingBot = await prisma.chatbot.findFirst({ where: { tenantId: tenant.id, name: 'Lead Qualifier Bot' } })
  if (!existingBot) {
    const bot = await prisma.chatbot.create({ data: { tenantId: tenant.id, name: 'Lead Qualifier Bot', status: 'ACTIVE', conversationsHandled: 1840 } })
    const nodeDefs = [
      { key: 'n1', type: 'start', x: 0, y: 0, data: { label: 'Start' } },
      { key: 'n2', type: 'message', x: 0, y: 120, data: { label: 'Message', text: 'Hi! What are you looking for today?' } },
      { key: 'n3', type: 'end', x: 0, y: 240, data: { label: 'End' } },
    ]
    for (const n of nodeDefs) {
      await prisma.chatbotNode.create({ data: { chatbotId: bot.id, nodeKey: n.key, type: n.type, positionX: n.x, positionY: n.y, data: n.data } })
    }
    await prisma.chatbotEdge.create({ data: { chatbotId: bot.id, edgeKey: 'e1', source: 'n1', target: 'n2' } })
    await prisma.chatbotEdge.create({ data: { chatbotId: bot.id, edgeKey: 'e2', source: 'n2', target: 'n3' } })
  }

  // --- Automations ---
  const existingAuto = await prisma.automation.findFirst({ where: { tenantId: tenant.id, name: 'New Lead Nurture' } })
  if (!existingAuto) {
    const automation = await prisma.automation.create({
      data: { tenantId: tenant.id, name: 'New Lead Nurture', status: 'ACTIVE', trigger: 'contact_created', runsThisMonth: 412 },
    })
    await prisma.automationAction.createMany({
      data: [
        { automationId: automation.id, order: 0, type: 'add_tag', config: { tag: 'new-lead' } },
        { automationId: automation.id, order: 1, type: 'send_message', config: { templateName: 'welcome_message' } },
      ],
    })
  }

  // --- AI Agents ---
  const existingAgent = await prisma.aIAgent.findFirst({ where: { tenantId: tenant.id, name: 'Sales Qualifier' } })
  if (!existingAgent) {
    const agent = await prisma.aIAgent.create({
      data: {
        tenantId: tenant.id,
        name: 'Sales Qualifier',
        description: 'Qualifies inbound leads and books demos for the sales team.',
        personality: 'Friendly, concise, consultative — never pushy.',
        businessInfo: 'Loopwave sells WhatsApp marketing & CRM software to SMBs and mid-market retailers.',
        goals: ['Qualify lead intent', 'Capture business size', 'Book a demo call'],
        qualificationQuestions: ['What industry are you in?', 'How many WhatsApp conversations do you handle monthly?'],
        handoffRules: 'Escalate to a human sales agent when the lead requests pricing negotiation.',
        status: 'ACTIVE',
        conversationsHandled: 926,
      },
    })
    await prisma.aIAgentFaq.createMany({
      data: [
        { agentId: agent.id, question: 'What does Loopwave cost?', answer: 'Plans start at ₹999/month.' },
        { agentId: agent.id, question: 'Do you offer a free trial?', answer: 'Yes, 14 days on any plan, no card required.' },
      ],
    })
  }

  // --- Forms ---
  const existingForm = await prisma.form.findFirst({ where: { tenantId: tenant.id, name: 'Demo Request Form' } })
  if (!existingForm) {
    await prisma.form.create({
      data: {
        tenantId: tenant.id,
        name: 'Demo Request Form',
        status: 'PUBLISHED',
        fields: [
          { id: 'f1', type: 'text', label: 'Full name', required: true },
          { id: 'f2', type: 'phone', label: 'Phone number', required: true },
          { id: 'f3', type: 'dropdown', label: 'Company size', options: ['1-10', '11-50', '51-200', '200+'], required: true },
        ],
      },
    })
  }

  // --- WhatsApp account (demo mode, no real Meta credentials) ---
  const existingWa = await prisma.whatsAppAccount.findFirst({ where: { tenantId: tenant.id } })
  if (!existingWa) {
    const wa = await prisma.whatsAppAccount.create({ data: { tenantId: tenant.id, isDemoMode: true } })
    await prisma.whatsAppPhoneNumber.create({
      data: { accountId: wa.id, displayNumber: '+91 98765 40001', label: 'Primary Business Line', status: 'PENDING_VERIFICATION' },
    })
  }

  // --- Integrations catalog rows (disconnected until real config is added) ---
  const integrationKeys = ['shopify', 'razorpay', 'hubspot', 'salesforce', 'zapier', 'slack', 'webhooks']
  for (const key of integrationKeys) {
    await prisma.integration.upsert({
      where: { tenantId_providerKey: { tenantId: tenant.id, providerKey: key } },
      create: { tenantId: tenant.id, providerKey: key, connected: false },
      update: {},
    })
  }

  // --- A second, smaller tenant so Super Admin views aren't single-row ---
  const secondOwner = await prisma.user.upsert({
    where: { email: 'owner@bluepeakretail.com' },
    create: { name: 'Jordan Blake', email: 'owner@bluepeakretail.com', passwordHash: await hashPassword(demoPassword) },
    update: {},
  })
  const secondTenant = await prisma.tenant.upsert({
    where: { slug: 'bluepeak-retail' },
    create: { name: 'Bluepeak Retail', slug: 'bluepeak-retail', status: 'ACTIVE' },
    update: {},
  })
  await prisma.membership.upsert({
    where: { tenantId_userId: { tenantId: secondTenant.id, userId: secondOwner.id } },
    create: { tenantId: secondTenant.id, userId: secondOwner.id, role: 'OWNER', status: 'ACTIVE' },
    update: {},
  })
  await prisma.subscription.upsert({
    where: { tenantId: secondTenant.id },
    create: { tenantId: secondTenant.id, planId: 'business', status: 'ACTIVE' },
    update: {},
  })

  console.log('Seed complete.')
  console.log(`Demo login: aisha@loopwavedemo.com / ${demoPassword} (change via SEED_DEMO_PASSWORD)`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
