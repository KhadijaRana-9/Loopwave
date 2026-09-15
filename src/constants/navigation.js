import {
  LayoutDashboard,
  Inbox,
  Users,
  Megaphone,
  FileText,
  Bot,
  Sparkles,
  Workflow,
  ClipboardList,
  KanbanSquare,
  BarChart3,
  UsersRound,
  MessageCircle,
  Plug,
  CreditCard,
  Settings,
  Building2,
  ShieldCheck,
  Layers,
  Activity,
  ScrollText,
} from 'lucide-react'
import { PERMISSIONS } from './permissions'

// Single source of truth for the business-app sidebar. Every entry maps to a
// real route under /app — nothing here is a placeholder link.
export const APP_NAV = [
  { to: '/app/dashboard', label: 'Dashboard', icon: LayoutDashboard, permission: null },
  { to: '/app/inbox', label: 'Inbox', icon: Inbox, permission: PERMISSIONS.VIEW_INBOX },
  { to: '/app/contacts', label: 'Contacts', icon: Users, permission: PERMISSIONS.VIEW_CONTACTS },
  { to: '/app/pipeline', label: 'Pipeline', icon: KanbanSquare, permission: PERMISSIONS.MANAGE_PIPELINE },
  { to: '/app/campaigns', label: 'Campaigns', icon: Megaphone, permission: PERMISSIONS.MANAGE_CAMPAIGNS },
  { to: '/app/templates', label: 'Templates', icon: FileText, permission: PERMISSIONS.MANAGE_CAMPAIGNS },
  { to: '/app/chatbots', label: 'Chatbots', icon: Bot, permission: PERMISSIONS.MANAGE_CHATBOT },
  { to: '/app/ai-agents', label: 'AI Agents', icon: Sparkles, permission: PERMISSIONS.MANAGE_AI_AGENTS },
  { to: '/app/automations', label: 'Automations', icon: Workflow, permission: PERMISSIONS.MANAGE_AUTOMATIONS },
  { to: '/app/forms', label: 'Forms', icon: ClipboardList, permission: PERMISSIONS.MANAGE_FORMS },
  { to: '/app/analytics', label: 'Analytics', icon: BarChart3, permission: PERMISSIONS.VIEW_ANALYTICS },
  { to: '/app/team', label: 'Team', icon: UsersRound, permission: PERMISSIONS.MANAGE_TEAM },
  { to: '/app/whatsapp', label: 'WhatsApp', icon: MessageCircle, permission: PERMISSIONS.MANAGE_WHATSAPP },
  { to: '/app/integrations', label: 'Integrations', icon: Plug, permission: PERMISSIONS.MANAGE_INTEGRATIONS },
  { to: '/app/billing', label: 'Billing', icon: CreditCard, permission: PERMISSIONS.MANAGE_BILLING },
  { to: '/app/settings', label: 'Settings', icon: Settings, permission: PERMISSIONS.MANAGE_SETTINGS },
]

// Super Admin sidebar — platform-level surface, gated purely on role.
export const ADMIN_NAV = [
  { to: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/admin/tenants', label: 'Tenants', icon: Building2 },
  { to: '/admin/users', label: 'Users', icon: Users },
  { to: '/admin/plans', label: 'Plans', icon: Layers },
  { to: '/admin/subscriptions', label: 'Subscriptions', icon: CreditCard },
  { to: '/admin/usage', label: 'Usage', icon: Activity },
  { to: '/admin/whatsapp', label: 'WhatsApp', icon: MessageCircle },
  { to: '/admin/campaigns', label: 'Campaigns', icon: Megaphone },
  { to: '/admin/ai', label: 'AI', icon: Sparkles },
  { to: '/admin/billing', label: 'Billing', icon: ShieldCheck },
  { to: '/admin/integrations', label: 'Integrations', icon: Plug },
  { to: '/admin/system-logs', label: 'System Logs', icon: ScrollText },
  { to: '/admin/settings', label: 'Settings', icon: Settings },
]
