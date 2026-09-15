// Plans are data, not hard-coded logic. Super Admin (/admin/plans) edits
// records shaped exactly like this, so the pricing page, billing screens and
// usage meters all read from the same shape whether the data is this seed
// list or a real API response later.

// -1 means "unlimited" for a given limit.
export const PLAN_LIMIT_KEYS = [
  { key: 'whatsappNumbers', label: 'WhatsApp numbers' },
  { key: 'teamMembers', label: 'Team members' },
  { key: 'contacts', label: 'Contacts' },
  { key: 'monthlyConversations', label: 'Monthly conversations' },
  { key: 'monthlyMarketingMessages', label: 'Monthly marketing messages' },
  { key: 'chatbotFlows', label: 'Chatbot flows' },
  { key: 'aiUsage', label: 'AI replies / month' },
  { key: 'automationWorkflows', label: 'Automation workflows' },
  { key: 'storageGb', label: 'Storage (GB)' },
  { key: 'analyticsHistoryDays', label: 'Analytics history (days)' },
  { key: 'integrations', label: 'Integrations' },
]

export const PLANS = [
  {
    id: 'trial',
    name: 'Free Trial',
    tagline: '14 days, full feature taste',
    price: 0,
    billingCycle: 'monthly',
    isTrial: true,
    limits: {
      whatsappNumbers: 1,
      teamMembers: 2,
      contacts: 500,
      monthlyConversations: 250,
      monthlyMarketingMessages: 250,
      chatbotFlows: 1,
      aiUsage: 100,
      automationWorkflows: 2,
      storageGb: 1,
      analyticsHistoryDays: 7,
      integrations: 1,
    },
  },
  {
    id: 'starter',
    name: 'Starter',
    tagline: 'For small teams getting started on WhatsApp',
    price: 999,
    billingCycle: 'monthly',
    limits: {
      whatsappNumbers: 1,
      teamMembers: 3,
      contacts: 2500,
      monthlyConversations: 1000,
      monthlyMarketingMessages: 2000,
      chatbotFlows: 3,
      aiUsage: 500,
      automationWorkflows: 5,
      storageGb: 5,
      analyticsHistoryDays: 30,
      integrations: 3,
    },
  },
  {
    id: 'pro',
    name: 'Pro',
    tagline: 'Growing teams running campaigns at scale',
    price: 2999,
    billingCycle: 'monthly',
    highlighted: true,
    limits: {
      whatsappNumbers: 3,
      teamMembers: 10,
      contacts: 15000,
      monthlyConversations: 8000,
      monthlyMarketingMessages: 20000,
      chatbotFlows: 10,
      aiUsage: 3000,
      automationWorkflows: 20,
      storageGb: 25,
      analyticsHistoryDays: 90,
      integrations: 10,
    },
  },
  {
    id: 'business',
    name: 'Business',
    tagline: 'Multi-agent teams with heavy automation needs',
    price: 7999,
    billingCycle: 'monthly',
    limits: {
      whatsappNumbers: 10,
      teamMembers: 40,
      contacts: 100000,
      monthlyConversations: 40000,
      monthlyMarketingMessages: 100000,
      chatbotFlows: 40,
      aiUsage: 15000,
      automationWorkflows: 100,
      storageGb: 100,
      analyticsHistoryDays: 180,
      integrations: 25,
    },
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    tagline: 'Custom limits, SLAs and dedicated support',
    price: null,
    billingCycle: 'custom',
    limits: {
      whatsappNumbers: -1,
      teamMembers: -1,
      contacts: -1,
      monthlyConversations: -1,
      monthlyMarketingMessages: -1,
      chatbotFlows: -1,
      aiUsage: -1,
      automationWorkflows: -1,
      storageGb: -1,
      analyticsHistoryDays: -1,
      integrations: -1,
    },
  },
]

export function getPlanById(planId) {
  return PLANS.find((plan) => plan.id === planId)
}

export function formatLimit(value) {
  if (value === -1) return 'Unlimited'
  return value.toLocaleString()
}

export function usagePercent(used, limit) {
  if (limit === -1) return 0
  if (limit === 0) return 100
  return Math.min(100, Math.round((used / limit) * 100))
}
