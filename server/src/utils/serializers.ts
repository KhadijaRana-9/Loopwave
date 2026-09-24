import type {
  AIAgent,
  AIAgentFaq,
  Automation,
  Chatbot,
  ChatbotEdge,
  ChatbotNode,
  Contact,
  Form,
  FormSubmission,
  Membership,
  Notification,
  Plan,
  Subscription,
  Template,
  Tenant,
  User,
  WhatsAppPhoneNumber,
} from '@prisma/client'

// Shapes DB rows into exactly what the frontend already expects (see
// src/store/authStore.js and src/services/mockData.js on the client) so
// swapping the mock authService for real API calls needs no UI changes.

export function serializeUser(user: User, role: string | null) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: role ? role.toLowerCase() : user.platformRole === 'SUPER_ADMIN' ? 'super_admin' : null,
    avatarColor: user.avatarColor,
  }
}

type TenantWithSubscription = Tenant & { subscription?: Subscription | null }

export function serializeTenant(tenant: TenantWithSubscription | null | undefined) {
  if (!tenant) return null
  return {
    id: tenant.id,
    name: tenant.name,
    slug: tenant.slug,
    status: tenant.status.toLowerCase(),
    planId: tenant.subscription?.planId ?? null,
    trialEndsAt: tenant.trialEndsAt,
    createdAt: tenant.createdAt,
  }
}

export function serializeMembership(membership: Membership | null | undefined) {
  if (!membership) return null
  return { id: membership.id, role: membership.role.toLowerCase(), status: membership.status.toLowerCase() }
}

type ContactWithTags = Contact & { tags?: { tag: { name: string } }[] }

export function serializeContact(contact: ContactWithTags) {
  return {
    id: contact.id,
    name: contact.name,
    phone: contact.phone,
    email: contact.email,
    company: contact.company,
    tags: contact.tags?.map((t) => t.tag.name) ?? [],
    source: contact.source,
    leadStatus: contact.leadStatus.toLowerCase(),
    leadScore: contact.leadScore,
    whatsappOptIn: contact.whatsappOptIn.toLowerCase(),
    optInSource: contact.optInSource,
    optOutAt: contact.optOutAt,
    assignedAgentId: contact.assignedAgentId,
    customFields: contact.customFields,
    lastInteractionAt: contact.lastInteractionAt,
    createdAt: contact.createdAt,
  }
}

// `id` is the User id, not the Membership id — every "agent" reference
// elsewhere (Contact.assignedAgentId, Deal.assignedAgentId,
// ConversationAssignment.agentId) points at a User, so the team list must
// expose the same id or assignment dropdowns silently mismatch.
export function serializeTeamMember(user: User, membership: Membership) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: membership.role.toLowerCase(),
    status: membership.status.toLowerCase(),
    lastActive: user.lastActiveAt,
  }
}

export function serializeTemplate(template: Template) {
  return {
    id: template.id,
    name: template.name,
    category: template.category,
    language: template.language,
    status: template.status.toLowerCase(),
    headerType: template.headerType.toLowerCase(),
    header: template.header,
    body: template.body,
    footer: template.footer,
    buttons: template.buttons,
    variables: template.variables,
    metaTemplateId: template.metaTemplateId,
    rejectedReason: template.rejectedReason,
    submittedAt: template.submittedAt,
    metaSyncedAt: template.metaSyncedAt,
    createdAt: template.createdAt,
    updatedAt: template.updatedAt,
  }
}

export function serializeChatbot(bot: Chatbot & { nodes?: ChatbotNode[]; edges?: ChatbotEdge[] }) {
  return {
    id: bot.id,
    name: bot.name,
    status: bot.status.toLowerCase(),
    triggers: bot.triggers,
    conversationsHandled: bot.conversationsHandled,
    updatedAt: bot.updatedAt,
    nodes: bot.nodes?.map((n) => ({ id: n.nodeKey, type: n.type, position: { x: n.positionX, y: n.positionY }, data: n.data })) ?? [],
    edges: bot.edges?.map((e) => ({ id: e.edgeKey, source: e.source, target: e.target, label: e.label ?? undefined })) ?? [],
  }
}

export function serializeAutomation(automation: Automation) {
  return {
    id: automation.id,
    name: automation.name,
    status: automation.status.toLowerCase(),
    trigger: automation.trigger,
    nodes: automation.nodes,
    edges: automation.edges,
    runsThisMonth: automation.runsThisMonth,
    updatedAt: automation.updatedAt,
  }
}

export function serializeAiAgent(agent: AIAgent & { faqs?: AIAgentFaq[] }) {
  return {
    id: agent.id,
    name: agent.name,
    description: agent.description,
    personality: agent.personality,
    businessInfo: agent.businessInfo,
    faqs: agent.faqs?.map((f) => ({ question: f.question, answer: f.answer })) ?? [],
    qualificationQuestions: agent.qualificationQuestions,
    goals: agent.goals,
    handoffRules: agent.handoffRules,
    status: agent.status.toLowerCase(),
    conversationsHandled: agent.conversationsHandled,
  }
}

export function serializeForm(form: Form & { _count?: { submissions: number } }) {
  return {
    id: form.id,
    name: form.name,
    status: form.status.toLowerCase(),
    fields: form.fields,
    submissions: form._count?.submissions ?? 0,
    createdAt: form.createdAt,
    updatedAt: form.updatedAt,
  }
}

export function serializeFormSubmission(sub: FormSubmission) {
  return { id: sub.id, formId: sub.formId, submittedAt: sub.submittedAt, values: sub.values }
}

export function serializeWhatsAppNumber(num: WhatsAppPhoneNumber) {
  return {
    id: num.id,
    displayNumber: num.displayNumber,
    label: num.label,
    verifiedName: num.verifiedName,
    status: num.status.toLowerCase(),
    qualityRating: num.qualityRating,
    messagingTier: num.messagingTier,
    connectedAt: num.connectedAt,
  }
}

export function serializeNotification(n: Notification) {
  return {
    id: n.id,
    category: n.category,
    title: n.title,
    body: n.body,
    read: Boolean(n.readAt),
    createdAt: n.createdAt,
  }
}

export function serializePlan(plan: Plan) {
  return {
    id: plan.id,
    name: plan.name,
    tagline: plan.tagline,
    price: plan.price,
    billingCycle: plan.billingCycle,
    isTrial: plan.isTrial,
    limits: plan.limits,
    highlighted: plan.id === 'pro',
  }
}
