import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Search, Send, Sparkles, Paperclip, FileText, Tag, User, Clock, ArrowLeft, Info, X } from 'lucide-react'
import clsx from 'clsx'
import Avatar from '@/components/ui/Avatar'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import { Select } from '@/components/ui/Input'
import Spinner from '@/components/ui/Spinner'
import EmptyState from '@/components/ui/EmptyState'
import * as conversationsService from '@/services/conversationsService'
import * as teamService from '@/services/teamService'
import * as templatesService from '@/services/templatesService'
import { getSocket } from '@/services/socket'
import { useAuthStore } from '@/store/authStore'

const STATUS_TABS = [
  { value: 'all', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'pending', label: 'Pending' },
  { value: 'resolved', label: 'Resolved' },
]

// Canned suggestions so "AI assist" produces a real, context-aware draft
// instead of doing nothing — a stand-in for a real LLM-backed reply endpoint.
const AI_SUGGESTIONS = [
  { match: /pric|cost|plan/i, reply: "Sure! Our plans start at ₹999/mo — I'll send over the full pricing breakdown now." },
  { match: /catalog|product/i, reply: 'Absolutely, here is our latest product catalog — let me know if anything stands out.' },
  { match: /demo|call/i, reply: 'Happy to set that up — does tomorrow afternoon work for a quick call?' },
  { match: /thank/i, reply: "You're welcome! Let us know if anything else comes up." },
]
function suggestReply(lastInboundText) {
  const hit = AI_SUGGESTIONS.find((s) => s.match.test(lastInboundText ?? ''))
  return hit?.reply ?? "Thanks for reaching out — could you share a bit more detail so I can help?"
}

export default function Inbox() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [status, setStatus] = useState(searchParams.get('status') ?? 'all')
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState(searchParams.get('conversationId'))
  const [mobileView, setMobileView] = useState(selectedId ? 'thread' : 'list')
  const [messageText, setMessageText] = useState('')
  const [showTemplates, setShowTemplates] = useState(false)
  const [noteText, setNoteText] = useState('')
  const [attachment, setAttachment] = useState(null)
  const fileInputRef = useRef(null)
  const queryClient = useQueryClient()
  const currentUser = useAuthStore((s) => s.user)

  // Clear one-time deep-link params from the URL once applied so they don't
  // stick around while the user keeps browsing the inbox.
  useEffect(() => {
    if (searchParams.get('status') || searchParams.get('conversationId')) {
      setSearchParams({}, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const listQuery = useQuery({
    queryKey: ['conversations', status, search],
    queryFn: () => conversationsService.listConversations({ status, search }),
  })

  // Real-time via Socket.IO (server/src/websocket/io.ts emits this on every
  // send) so a reply or an inbound message shows up without a manual refresh.
  useEffect(() => {
    const socket = getSocket()
    function handleMessage() {
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
    }
    socket.on('conversation:message', handleMessage)
    return () => socket.off('conversation:message', handleMessage)
  }, [queryClient])

  const teamQuery = useQuery({ queryKey: ['team'], queryFn: teamService.listTeamMembers })
  const templatesQuery = useQuery({ queryKey: ['templates'], queryFn: templatesService.listTemplates })

  const conversations = listQuery.data ?? []
  const teamMembers = teamQuery.data ?? []
  const templates = templatesQuery.data ?? []
  const activeId = selectedId ?? conversations[0]?.id
  const active = conversations.find((c) => c.id === activeId)

  const sendMutation = useMutation({
    mutationFn: ({ id, text }) => conversationsService.sendMessage(id, text),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['conversations'] }),
  })

  const assignMutation = useMutation({
    mutationFn: ({ id, agentId }) => conversationsService.assignConversation(id, agentId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['conversations'] }),
  })

  const statusMutation = useMutation({
    mutationFn: ({ id, value }) => conversationsService.updateConversationStatus(id, value),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['conversations'] }),
  })

  const noteMutation = useMutation({
    mutationFn: ({ id, text }) => conversationsService.addNote(id, text, currentUser?.name ?? 'You'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      setNoteText('')
    },
  })

  function selectConversation(id) {
    setSelectedId(id)
    setMobileView('thread')
  }

  function handleSend() {
    if ((!messageText.trim() && !attachment) || !active) return
    const text = attachment ? `${messageText.trim() ? messageText.trim() + ' ' : ''}📎 ${attachment.name}` : messageText.trim()
    sendMutation.mutate({ id: active.id, text })
    setMessageText('')
    setAttachment(null)
  }

  function insertTemplate(template) {
    setMessageText(template.body.replace(/\{\{\d+\}\}/g, '___'))
    setShowTemplates(false)
  }

  function handleAiAssist() {
    const lastInbound = [...(active?.messages ?? [])].reverse().find((m) => m.direction === 'inbound')
    setMessageText(suggestReply(lastInbound?.text))
  }

  function agentName(id) {
    return teamMembers.find((m) => m.id === id)?.name ?? 'Unassigned'
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-4">
      {/* Conversation list */}
      <div
        className={clsx(
          'w-full shrink-0 flex-col rounded-xl border border-ink-200 bg-white lg:flex lg:w-80',
          mobileView === 'list' ? 'flex' : 'hidden',
        )}
      >
        <div className="border-b border-ink-100 p-3">
          <div className="flex items-center gap-2 rounded-lg border border-ink-200 px-3 py-2">
            <Search className="h-4 w-4 text-ink-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search conversations"
              className="w-full bg-transparent text-sm outline-none placeholder:text-ink-400"
            />
          </div>
          <div className="mt-3 flex gap-1">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setStatus(tab.value)}
                className={clsx(
                  'rounded-full px-2.5 py-1 text-xs font-medium',
                  status === tab.value ? 'bg-brand-100 text-brand-700' : 'text-ink-500 hover:bg-ink-100',
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {listQuery.isLoading && <Spinner />}
          {!listQuery.isLoading && conversations.length === 0 && (
            <EmptyState title="No conversations" description="Nothing matches these filters." />
          )}
          {conversations.map((conv) => (
            <button
              key={conv.id}
              onClick={() => selectConversation(conv.id)}
              className={clsx(
                'flex w-full items-start gap-3 border-b border-ink-100 p-3 text-left hover:bg-ink-50',
                activeId === conv.id && 'bg-brand-50',
              )}
            >
              <Avatar name={conv.contact?.name} size={36} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium text-ink-900">{conv.contact?.name}</span>
                  {conv.unread > 0 && (
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-500 text-[10px] font-semibold text-white">
                      {conv.unread}
                    </span>
                  )}
                </div>
                <p className="truncate text-xs text-ink-500">
                  {conv.messages[conv.messages.length - 1]?.text}
                </p>
                <div className="mt-1 flex items-center gap-1.5">
                  {conv.priority === 'high' && <Badge tone="danger">High priority</Badge>}
                  <Badge tone={conv.status === 'resolved' ? 'success' : conv.status === 'pending' ? 'warning' : 'neutral'}>
                    {conv.status}
                  </Badge>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Message thread */}
      <div
        className={clsx(
          'flex-1 flex-col rounded-xl border border-ink-200 bg-white lg:flex',
          mobileView === 'thread' ? 'flex' : 'hidden',
        )}
      >
        {!active ? (
          <EmptyState title="Select a conversation" description="Choose a conversation from the list to view messages." />
        ) : (
          <>
            <div className="flex items-center justify-between border-b border-ink-100 p-4">
              <div className="flex items-center gap-3">
                <button onClick={() => setMobileView('list')} className="rounded-lg p-1 text-ink-400 hover:bg-ink-100 lg:hidden" aria-label="Back to conversation list">
                  <ArrowLeft className="h-4.5 w-4.5" />
                </button>
                <Avatar name={active.contact?.name} size={36} />
                <div>
                  <div className="text-sm font-semibold text-ink-900">{active.contact?.name}</div>
                  <div className="text-xs text-ink-500">{active.contact?.phone}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Select
                  aria-label="Conversation status"
                  value={active.status}
                  onChange={(e) => statusMutation.mutate({ id: active.id, value: e.target.value })}
                  className="h-8 text-xs"
                >
                  <option value="open">Open</option>
                  <option value="pending">Pending</option>
                  <option value="resolved">Resolved</option>
                </Select>
                <Select
                  aria-label="Assign conversation to agent"
                  value={active.assignedAgentId ?? ''}
                  onChange={(e) => assignMutation.mutate({ id: active.id, agentId: e.target.value || null })}
                  className="hidden h-8 text-xs sm:block"
                >
                  <option value="">Unassigned</option>
                  {teamMembers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </Select>
                <button onClick={() => setMobileView('profile')} className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 lg:hidden" aria-label="View contact profile">
                  <Info className="h-4.5 w-4.5" />
                </button>
              </div>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {active.messages.map((msg) => (
                <div key={msg.id} className={clsx('flex', msg.direction === 'outbound' ? 'justify-end' : 'justify-start')}>
                  <div
                    className={clsx(
                      'max-w-md rounded-2xl px-4 py-2 text-sm',
                      msg.direction === 'outbound' ? 'bg-brand-500 text-white' : 'bg-ink-100 text-ink-800',
                    )}
                  >
                    {msg.text}
                    <div className={clsx('mt-1 text-[10px]', msg.direction === 'outbound' ? 'text-white' : 'text-ink-500')}>
                      {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {msg.status}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="relative border-t border-ink-100 p-3">
              {showTemplates && (
                <div className="absolute bottom-full left-3 mb-2 w-80 rounded-lg border border-ink-200 bg-white p-2 shadow-lg">
                  {templates.slice(0, 4).map((t) => (
                    <button
                      key={t.id}
                      onClick={() => insertTemplate(t)}
                      className="block w-full rounded-md p-2 text-left text-xs hover:bg-ink-50"
                    >
                      <span className="font-medium text-ink-800">{t.name}</span>
                      <p className="truncate text-ink-500">{t.body}</p>
                    </button>
                  ))}
                </div>
              )}
              {attachment && (
                <div className="mb-2 flex w-fit items-center gap-2 rounded-lg bg-ink-100 px-2.5 py-1.5 text-xs text-ink-700">
                  <Paperclip className="h-3.5 w-3.5" /> {attachment.name}
                  <button onClick={() => setAttachment(null)} className="text-ink-400 hover:text-ink-700" aria-label="Remove attachment">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
              <div className="flex items-end gap-2">
                <button
                  onClick={() => setShowTemplates((v) => !v)}
                  className="rounded-lg p-2 text-ink-400 hover:bg-ink-100"
                  title="Insert template"
                  aria-label="Insert template"
                >
                  <FileText className="h-4.5 w-4.5" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && setAttachment(e.target.files[0])}
                />
                <button onClick={() => fileInputRef.current?.click()} className="rounded-lg p-2 text-ink-400 hover:bg-ink-100" title="Attach media" aria-label="Attach media">
                  <Paperclip className="h-4.5 w-4.5" />
                </button>
                <button onClick={handleAiAssist} className="rounded-lg p-2 text-brand-500 hover:bg-brand-50" title="AI assist: suggest a reply" aria-label="AI assist: suggest a reply">
                  <Sparkles className="h-4.5 w-4.5" />
                </button>
                <textarea
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleSend()
                    }
                  }}
                  rows={1}
                  placeholder="Type a message..."
                  className="max-h-32 flex-1 resize-none rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
                />
                <Button onClick={handleSend} loading={sendMutation.isPending} size="icon" aria-label="Send message">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Contact profile */}
      {active && (
        <div
          className={clsx(
            'w-full shrink-0 space-y-4 overflow-y-auto rounded-xl border border-ink-200 bg-white p-4 lg:flex lg:w-72 lg:flex-col',
            mobileView === 'profile' ? 'flex flex-col' : 'hidden',
          )}
        >
          <button onClick={() => setMobileView('thread')} className="flex items-center gap-1.5 text-xs text-ink-500 lg:hidden">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to conversation
          </button>
          <div className="flex flex-col items-center text-center">
            <Avatar name={active.contact?.name} size={56} />
            <h3 className="mt-2 text-sm font-semibold text-ink-900">{active.contact?.name}</h3>
            <p className="text-xs text-ink-500">{active.contact?.phone}</p>
          </div>

          <div className="space-y-2 text-xs text-ink-500">
            <div className="flex items-center gap-2">
              <User className="h-3.5 w-3.5" /> Assigned to {agentName(active.assignedAgentId)}
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-3.5 w-3.5" /> Last active {active.lastMessageAt ? new Date(active.lastMessageAt).toLocaleString() : 'No messages yet'}
            </div>
          </div>

          <div>
            <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-ink-600">
              <Tag className="h-3.5 w-3.5" /> Tags
            </div>
            <div className="flex flex-wrap gap-1.5">
              {active.tags.length ? active.tags.map((t) => <Badge key={t}>{t}</Badge>) : <span className="text-xs text-ink-400">No tags</span>}
            </div>
          </div>

          <div>
            <div className="mb-1.5 text-xs font-medium text-ink-600">Internal notes</div>
            <div className="space-y-2">
              {active.notes.length === 0 && <p className="text-xs text-ink-400">No notes yet.</p>}
              {active.notes.map((note) => (
                <div key={note.id} className="rounded-lg bg-ink-50 p-2 text-xs">
                  <p className="text-ink-700">{note.text}</p>
                  <span className="text-ink-400">— {note.author}</span>
                </div>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <input
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && noteText.trim() && noteMutation.mutate({ id: active.id, text: noteText.trim() })}
                placeholder="Add an internal note..."
                className="h-8 flex-1 rounded-lg border border-ink-200 px-2.5 text-xs outline-none focus:border-brand-500"
              />
              <Button
                size="sm"
                variant="outline"
                disabled={!noteText.trim()}
                loading={noteMutation.isPending}
                onClick={() => noteMutation.mutate({ id: active.id, text: noteText.trim() })}
              >
                Add
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
