// Server-side mirror of src/constants/permissions.js and roles.js in the
// frontend. This is the copy that actually matters for security — the
// frontend matrix only controls what renders, this one controls what the
// API allows. Keep the two in sync by hand; they're small and change rarely.

export const PERMISSIONS = {
  MANAGE_BILLING: 'manage_billing',
  MANAGE_TEAM: 'manage_team',
  MANAGE_WHATSAPP: 'manage_whatsapp',
  VIEW_CONTACTS: 'view_contacts',
  EDIT_CONTACTS: 'edit_contacts',
  MANAGE_CAMPAIGNS: 'manage_campaigns',
  SEND_CAMPAIGNS: 'send_campaigns',
  MANAGE_CHATBOT: 'manage_chatbot',
  MANAGE_AUTOMATIONS: 'manage_automations',
  MANAGE_AI_AGENTS: 'manage_ai_agents',
  MANAGE_FORMS: 'manage_forms',
  MANAGE_PIPELINE: 'manage_pipeline',
  VIEW_ANALYTICS: 'view_analytics',
  MANAGE_INTEGRATIONS: 'manage_integrations',
  MANAGE_SETTINGS: 'manage_settings',
  VIEW_INBOX: 'view_inbox',
  REPLY_INBOX: 'reply_inbox',
  ASSIGN_CONVERSATIONS: 'assign_conversations',
} as const

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS]

const ALL_PERMISSIONS = Object.values(PERMISSIONS)

export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  OWNER: ALL_PERMISSIONS,
  ADMIN: ALL_PERMISSIONS.filter((p) => p !== PERMISSIONS.MANAGE_BILLING),
  MANAGER: [
    PERMISSIONS.VIEW_CONTACTS,
    PERMISSIONS.EDIT_CONTACTS,
    PERMISSIONS.MANAGE_CAMPAIGNS,
    PERMISSIONS.SEND_CAMPAIGNS,
    PERMISSIONS.MANAGE_CHATBOT,
    PERMISSIONS.MANAGE_AUTOMATIONS,
    PERMISSIONS.MANAGE_AI_AGENTS,
    PERMISSIONS.MANAGE_FORMS,
    PERMISSIONS.MANAGE_PIPELINE,
    PERMISSIONS.VIEW_ANALYTICS,
    PERMISSIONS.VIEW_INBOX,
    PERMISSIONS.REPLY_INBOX,
    PERMISSIONS.ASSIGN_CONVERSATIONS,
  ],
  SALES_AGENT: [
    PERMISSIONS.VIEW_CONTACTS,
    PERMISSIONS.EDIT_CONTACTS,
    PERMISSIONS.MANAGE_PIPELINE,
    PERMISSIONS.VIEW_INBOX,
    PERMISSIONS.REPLY_INBOX,
    PERMISSIONS.VIEW_ANALYTICS,
  ],
  SUPPORT_AGENT: [PERMISSIONS.VIEW_CONTACTS, PERMISSIONS.VIEW_INBOX, PERMISSIONS.REPLY_INBOX],
  VIEWER: [PERMISSIONS.VIEW_CONTACTS, PERMISSIONS.VIEW_ANALYTICS, PERMISSIONS.VIEW_INBOX],
}

export function hasPermission(role: string | null | undefined, permission: Permission): boolean {
  if (!role) return false
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false
}
