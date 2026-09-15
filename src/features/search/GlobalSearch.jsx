import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Search, X, User, MessageSquare, Megaphone, FileText, Bot, Workflow, Loader2 } from 'lucide-react'
import * as contactsService from '@/services/contactsService'
import * as conversationsService from '@/services/conversationsService'
import * as campaignsService from '@/services/campaignsService'
import * as templatesService from '@/services/templatesService'
import * as chatbotsService from '@/services/chatbotsService'
import * as automationsService from '@/services/automationsService'

const GROUPS = [
  { key: 'contacts', label: 'Contacts', icon: User },
  { key: 'conversations', label: 'Conversations', icon: MessageSquare },
  { key: 'campaigns', label: 'Campaigns', icon: Megaphone },
  { key: 'templates', label: 'Templates', icon: FileText },
  { key: 'chatbots', label: 'Chatbots', icon: Bot },
  { key: 'automations', label: 'Automations', icon: Workflow },
]

export default function GlobalSearch() {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const containerRef = useRef(null)
  const inputRef = useRef(null)
  const navigate = useNavigate()

  // These lists are small and already used elsewhere in the app (usually
  // warm in the query cache), so fetching all of them here and filtering
  // client-side is simpler than a dedicated search endpoint would be —
  // and it's the same seam (services/*) a real backend search would sit behind.
  const contactsQ = useQuery({ queryKey: ['contacts'], queryFn: () => contactsService.listContacts() })
  const conversationsQ = useQuery({ queryKey: ['conversations'], queryFn: () => conversationsService.listConversations() })
  const campaignsQ = useQuery({ queryKey: ['campaigns'], queryFn: campaignsService.listCampaigns })
  const templatesQ = useQuery({ queryKey: ['templates'], queryFn: templatesService.listTemplates })
  const chatbotsQ = useQuery({ queryKey: ['chatbots'], queryFn: chatbotsService.listChatbots })
  const automationsQ = useQuery({ queryKey: ['automations'], queryFn: automationsService.listAutomations })

  const loading = [contactsQ, conversationsQ, campaignsQ, templatesQ, chatbotsQ, automationsQ].some((q) => q.isLoading)

  useEffect(() => {
    function handleClick(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false)
    }
    function handleKey(e) {
      if (e.key === 'Escape') setOpen(false)
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [])

  const q = query.trim().toLowerCase()
  const results =
    q.length === 0
      ? {}
      : {
          contacts: (contactsQ.data ?? []).filter((c) => c.name.toLowerCase().includes(q) || c.phone.includes(q) || c.email?.toLowerCase().includes(q)).slice(0, 4),
          conversations: (conversationsQ.data ?? []).filter((c) => c.contact?.name.toLowerCase().includes(q)).slice(0, 4),
          campaigns: (campaignsQ.data ?? []).filter((c) => c.name.toLowerCase().includes(q)).slice(0, 4),
          templates: (templatesQ.data ?? []).filter((t) => t.name.toLowerCase().includes(q)).slice(0, 4),
          chatbots: (chatbotsQ.data ?? []).filter((b) => b.name.toLowerCase().includes(q)).slice(0, 4),
          automations: (automationsQ.data ?? []).filter((a) => a.name.toLowerCase().includes(q)).slice(0, 4),
        }

  const totalResults = Object.values(results).reduce((sum, arr) => sum + (arr?.length ?? 0), 0)

  function goTo(path) {
    navigate(path)
    setOpen(false)
    setQuery('')
  }

  function renderItem(group, item) {
    switch (group) {
      case 'contacts':
        return (
          <button key={item.id} onClick={() => goTo(`/app/contacts?highlight=${item.id}`)} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm hover:bg-ink-100">
            <span className="font-medium text-ink-800">{item.name}</span>
            <span className="text-xs text-ink-400">{item.phone}</span>
          </button>
        )
      case 'conversations':
        return (
          <button key={item.id} onClick={() => goTo(`/app/inbox?conversationId=${item.id}`)} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm hover:bg-ink-100">
            <span className="font-medium text-ink-800">{item.contact?.name}</span>
            <span className="truncate text-xs text-ink-400">{item.messages[item.messages.length - 1]?.text}</span>
          </button>
        )
      case 'campaigns':
        return (
          <button key={item.id} onClick={() => goTo(`/app/campaigns/${item.id}`)} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm hover:bg-ink-100">
            <span className="font-medium text-ink-800">{item.name}</span>
            <span className="text-xs capitalize text-ink-400">{item.status}</span>
          </button>
        )
      case 'templates':
        return (
          <button key={item.id} onClick={() => goTo('/app/templates')} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm hover:bg-ink-100">
            <span className="font-mono text-xs font-medium text-ink-800">{item.name}</span>
            <span className="text-xs capitalize text-ink-400">{item.status}</span>
          </button>
        )
      case 'chatbots':
        return (
          <button key={item.id} onClick={() => goTo(`/app/chatbots/${item.id}`)} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm hover:bg-ink-100">
            <span className="font-medium text-ink-800">{item.name}</span>
            <span className="text-xs capitalize text-ink-400">{item.status}</span>
          </button>
        )
      case 'automations':
        return (
          <button key={item.id} onClick={() => goTo(`/app/automations/${item.id}`)} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm hover:bg-ink-100">
            <span className="font-medium text-ink-800">{item.name}</span>
            <span className="text-xs capitalize text-ink-400">{item.status}</span>
          </button>
        )
      default:
        return null
    }
  }

  return (
    <div ref={containerRef} className="relative hidden max-w-md flex-1 md:block">
      <div className="flex items-center gap-2 rounded-lg border border-ink-200 px-3 py-2 focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-100">
        <Search className="h-4 w-4 shrink-0 text-ink-400" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search contacts, campaigns, conversations..."
          aria-label="Search across your workspace"
          className="w-full bg-transparent text-sm text-ink-700 outline-none placeholder:text-ink-400"
        />
        {loading && q.length > 0 && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-ink-300" />}
        {query && (
          <button onClick={() => { setQuery(''); inputRef.current?.focus() }} aria-label="Clear search" className="shrink-0 text-ink-300 hover:text-ink-600">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
        <kbd className="hidden shrink-0 rounded border border-ink-200 px-1.5 py-0.5 text-[10px] font-medium text-ink-400 lg:block">⌘K</kbd>
      </div>

      {open && q.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-30 mt-2 max-h-96 overflow-y-auto rounded-xl border border-ink-200 bg-white p-2 shadow-lg">
          {!loading && totalResults === 0 && (
            <div className="px-3 py-8 text-center text-sm text-ink-400">
              No results for "<span className="font-medium text-ink-600">{query}</span>"
            </div>
          )}
          {GROUPS.map((group) => {
            const items = results[group.key]
            if (!items || items.length === 0) return null
            return (
              <div key={group.key} className="mb-1 last:mb-0">
                <div className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-400">
                  <group.icon className="h-3 w-3" /> {group.label}
                </div>
                {items.map((item) => renderItem(group.key, item))}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
