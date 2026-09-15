import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell, Check } from 'lucide-react'
import * as notificationsService from '@/services/notificationsService'
import { getSocket } from '@/services/socket'

const CATEGORY_LABEL = {
  campaign_completed: 'Campaign',
  campaign_failed: 'Campaign',
  new_lead: 'New lead',
  assignment: 'Assignment',
  system: 'System',
  billing: 'Billing',
  integration_error: 'Integration',
}

// Real-time via Socket.IO (see server/src/websocket/io.ts): a new
// notification pushes an invalidation instead of the panel polling on a
// short interval, so it shows up the moment the backend creates it.
export default function NotificationBell() {
  const [open, setOpen] = useState(false)
  const containerRef = useRef(null)
  const queryClient = useQueryClient()

  const { data } = useQuery({ queryKey: ['notifications'], queryFn: notificationsService.listNotifications, refetchInterval: 60_000 })
  const notifications = data?.notifications ?? []
  const unreadCount = data?.unreadCount ?? 0

  useEffect(() => {
    const socket = getSocket()
    function handleNew() {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    }
    socket.on('notification:new', handleNew)
    return () => socket.off('notification:new', handleNew)
  }, [queryClient])

  useEffect(() => {
    function handleClick(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false)
    }
    function handleKey(e) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [])

  async function markAllRead() {
    await notificationsService.markAllNotificationsRead()
    queryClient.invalidateQueries({ queryKey: ['notifications'] })
  }

  async function handleOpenNotification(n) {
    if (!n.read) {
      await notificationsService.markNotificationRead(n.id)
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}
        aria-expanded={open}
        className="relative rounded-lg p-2 text-ink-400 hover:bg-ink-100"
      >
        <Bell className="h-4.5 w-4.5" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger-500 px-1 text-[10px] font-semibold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div role="menu" className="absolute right-0 top-full z-30 mt-2 w-80 rounded-xl border border-ink-200 bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-ink-100 px-3 py-2.5">
            <span className="text-sm font-semibold text-ink-900">Notifications</span>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline">
                <Check className="h-3 w-3" /> Mark all read
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 && <div className="px-3 py-8 text-center text-sm text-ink-400">You're all caught up.</div>}
            {notifications.map((n) => (
              <button
                key={n.id}
                onClick={() => handleOpenNotification(n)}
                className={`flex w-full flex-col gap-0.5 border-b border-ink-50 px-3 py-2.5 text-left last:border-0 hover:bg-ink-50 ${n.read ? '' : 'bg-brand-50/40'}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-ink-500">{CATEGORY_LABEL[n.category] ?? 'Update'}</span>
                  {!n.read && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" aria-hidden="true" />}
                </div>
                <span className="text-sm text-ink-800">{n.title}</span>
                {n.body && <span className="text-xs text-ink-500">{n.body}</span>}
                <span className="text-[10px] text-ink-400">{new Date(n.createdAt).toLocaleString()}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
