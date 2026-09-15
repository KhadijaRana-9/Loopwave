import {
  Play,
  MessageSquare,
  HelpCircle,
  MousePointerClick,
  List,
  GitBranch,
  Clock,
  UserCheck,
  Tag,
  UserCog,
  Globe,
  Sparkles,
  Bell,
  Flag,
  Zap,
} from 'lucide-react'

// Shared node-type registry for both the Chatbot Builder and the Automation
// Builder — each entry drives the node's icon/color on canvas and the field
// shown in the inspector panel when it's selected.
export const NODE_CONFIG = {
  start: { label: 'Start', icon: Play, color: '#16a34a', field: null },
  trigger: { label: 'Trigger', icon: Zap, color: '#16a34a', field: null },
  message: { label: 'Message', icon: MessageSquare, color: '#4a63f7', field: 'text' },
  question: { label: 'Question', icon: HelpCircle, color: '#4a63f7', field: 'text' },
  button: { label: 'Button', icon: MousePointerClick, color: '#4a63f7', field: 'text' },
  list: { label: 'List', icon: List, color: '#4a63f7', field: 'text' },
  condition: { label: 'Condition', icon: GitBranch, color: '#d97706', field: 'text' },
  delay: { label: 'Delay', icon: Clock, color: '#737d92', field: 'text' },
  assign_agent: { label: 'Assign Agent', icon: UserCheck, color: '#2563eb', field: 'text' },
  add_tag: { label: 'Add Tag', icon: Tag, color: '#2563eb', field: 'text' },
  update_contact: { label: 'Update Contact', icon: UserCog, color: '#2563eb', field: 'text' },
  notify_team: { label: 'Notify Team', icon: Bell, color: '#2563eb', field: 'text' },
  api_request: { label: 'API Request', icon: Globe, color: '#737d92', field: 'text' },
  ai_response: { label: 'AI Response', icon: Sparkles, color: '#9333ea', field: 'text' },
  end: { label: 'End', icon: Flag, color: '#dc2626', field: null },
}

export const CHATBOT_PALETTE = [
  'message', 'question', 'button', 'list', 'condition', 'delay',
  'assign_agent', 'add_tag', 'update_contact', 'api_request', 'ai_response', 'end',
]

export const AUTOMATION_PALETTE = [
  'add_tag', 'message', 'delay', 'ai_response', 'condition',
  'assign_agent', 'update_contact', 'notify_team', 'api_request', 'end',
]
