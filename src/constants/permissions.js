import { ROLES } from './roles'

// The full set of modular permissions checked throughout the app.
// Screens/actions should call hasPermission(role, PERMISSIONS.X) rather than
// hard-coding role checks, so the mapping below is the single source of truth.
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
}

const ALL_PERMISSIONS = Object.values(PERMISSIONS)

// Role -> permission grants. Platform Super Admin operates in a separate
// /admin surface and is not part of this tenant-scoped matrix.
export const ROLE_PERMISSIONS = {
  [ROLES.OWNER]: ALL_PERMISSIONS,
  [ROLES.ADMIN]: ALL_PERMISSIONS.filter((p) => p !== PERMISSIONS.MANAGE_BILLING),
  [ROLES.MANAGER]: [
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
  [ROLES.SALES_AGENT]: [
    PERMISSIONS.VIEW_CONTACTS,
    PERMISSIONS.EDIT_CONTACTS,
    PERMISSIONS.MANAGE_PIPELINE,
    PERMISSIONS.VIEW_INBOX,
    PERMISSIONS.REPLY_INBOX,
    PERMISSIONS.VIEW_ANALYTICS,
  ],
  [ROLES.SUPPORT_AGENT]: [
    PERMISSIONS.VIEW_CONTACTS,
    PERMISSIONS.VIEW_INBOX,
    PERMISSIONS.REPLY_INBOX,
  ],
  [ROLES.VIEWER]: [
    PERMISSIONS.VIEW_CONTACTS,
    PERMISSIONS.VIEW_ANALYTICS,
    PERMISSIONS.VIEW_INBOX,
  ],
}

export function hasPermission(role, permission) {
  if (!role) return false
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false
}

export function hasAnyPermission(role, permissionList) {
  return permissionList.some((permission) => hasPermission(role, permission))
}
