import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { ChevronsLeft, ChevronsRight, LogOut, Menu, Settings, X } from 'lucide-react'
import clsx from 'clsx'
import Logo from '@/components/Logo'
import Avatar from '@/components/ui/Avatar'
import Badge from '@/components/ui/Badge'
import GlobalSearch from '@/features/search/GlobalSearch'
import NotificationBell from '@/features/notifications/NotificationBell'
import WhatsappReauthBanner from '@/features/whatsapp/WhatsappReauthBanner'
import { APP_NAV } from '@/constants/navigation'
import { usePermission } from '@/hooks/usePermission'
import { useAuthStore } from '@/store/authStore'
import { useUiStore } from '@/store/uiStore'
import { getPlanById } from '@/constants/plans'

export default function AppLayout() {
  const { can } = usePermission()
  const user = useAuthStore((s) => s.user)
  const tenant = useAuthStore((s) => s.tenant)
  const logout = useAuthStore((s) => s.logout)
  const navigate = useNavigate()
  const { sidebarCollapsed, toggleSidebar, mobileNavOpen, setMobileNavOpen } = useUiStore()

  const visibleNav = APP_NAV.filter((item) => !item.permission || can(item.permission))
  const plan = tenant ? getPlanById(tenant.planId) : null

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  return (
    <div className="flex h-screen overflow-hidden bg-ink-50">
      {/* Desktop sidebar */}
      <aside
        className={clsx(
          'hidden shrink-0 flex-col border-r border-ink-200 bg-white transition-all md:flex',
          sidebarCollapsed ? 'w-[72px]' : 'w-64',
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-ink-100 px-4">
          {!sidebarCollapsed && <Logo />}
          <button
            onClick={toggleSidebar}
            className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100"
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {sidebarCollapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto p-3">
          {visibleNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                clsx(
                  'mb-1 flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive ? 'bg-brand-50 text-brand-700' : 'text-ink-600 hover:bg-ink-100',
                )
              }
            >
              <item.icon className="h-4.5 w-4.5 shrink-0" />
              {!sidebarCollapsed && item.label}
            </NavLink>
          ))}
        </nav>
        {!sidebarCollapsed && plan && (
          <div className="m-3 rounded-lg bg-ink-50 p-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-ink-700">{plan.name} plan</span>
              <Badge tone="brand">Active</Badge>
            </div>
            <button
              onClick={() => navigate('/app/billing')}
              className="mt-2 text-xs font-medium text-brand-600 hover:underline"
            >
              Manage plan
            </button>
          </div>
        )}
      </aside>

      {/* Mobile sidebar */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="absolute inset-0 bg-ink-950/40" onClick={() => setMobileNavOpen(false)} />
          <div className="relative z-10 flex h-full w-64 flex-col bg-white">
            <div className="flex h-16 items-center justify-between border-b border-ink-100 px-4">
              <Logo />
              <button onClick={() => setMobileNavOpen(false)} aria-label="Close navigation menu">
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto p-3">
              {visibleNav.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileNavOpen(false)}
                  className={({ isActive }) =>
                    clsx(
                      'mb-1 flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium',
                      isActive ? 'bg-brand-50 text-brand-700' : 'text-ink-600 hover:bg-ink-100',
                    )
                  }
                >
                  <item.icon className="h-4.5 w-4.5" />
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center gap-4 border-b border-ink-200 bg-white px-4 sm:px-6">
          <button className="text-ink-500 md:hidden" onClick={() => setMobileNavOpen(true)} aria-label="Open navigation menu">
            <Menu className="h-5 w-5" />
          </button>
          <GlobalSearch />
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-sm font-medium text-ink-700 sm:block">{tenant?.name}</span>
            <NotificationBell />
            <button onClick={() => navigate('/app/settings')} className="rounded-lg p-2 text-ink-400 hover:bg-ink-100" aria-label="Settings" title="Settings">
              <Settings className="h-4.5 w-4.5" />
            </button>
            <div className="flex items-center gap-2">
              <Avatar name={user?.name} color={user?.avatarColor} size={32} />
              <div className="hidden text-sm leading-tight sm:block">
                <div className="font-medium text-ink-800">{user?.name}</div>
                <div className="text-xs capitalize text-ink-400">{user?.role?.replace('_', ' ')}</div>
              </div>
            </div>
            <button onClick={handleLogout} className="rounded-lg p-2 text-ink-400 hover:bg-ink-100" title="Log out">
              <LogOut className="h-4.5 w-4.5" />
            </button>
          </div>
        </header>

        <WhatsappReauthBanner />

        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
