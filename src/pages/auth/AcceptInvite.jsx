import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import Logo from '@/components/Logo'
import Button from '@/components/ui/Button'
import Spinner from '@/components/ui/Spinner'
import EmptyState from '@/components/ui/EmptyState'
import { Input } from '@/components/ui/Input'
import { useAuthStore } from '@/store/authStore'
import { toast } from '@/store/toastStore'
import * as authService from '@/services/authService'
import { ROLE_LABELS } from '@/constants/roles'

export default function AcceptInvite() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const [password, setPassword] = useState('')
  const acceptInvite = useAuthStore((s) => s.acceptInvite)
  const status = useAuthStore((s) => s.status)
  const navigate = useNavigate()

  const inviteQuery = useQuery({
    queryKey: ['invite', token],
    queryFn: () => authService.checkInvite(token),
    enabled: !!token,
    retry: false,
  })

  async function handleSubmit(e) {
    e.preventDefault()
    try {
      await acceptInvite({ token, password })
      toast.success('Welcome aboard!')
      navigate('/app/dashboard', { replace: true })
    } catch (err) {
      toast.error(err.message || 'Could not accept this invite. Please try again.')
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Link to="/">
            <Logo />
          </Link>
        </div>

        {!token && (
          <div className="rounded-xl border border-ink-200 bg-white p-6 shadow-sm">
            <EmptyState title="Invite link missing" description="This link is missing its invite token. Ask whoever invited you to resend it." />
          </div>
        )}

        {token && inviteQuery.isLoading && (
          <div className="flex justify-center rounded-xl border border-ink-200 bg-white p-10 shadow-sm">
            <Spinner label="Checking your invite..." />
          </div>
        )}

        {token && inviteQuery.isError && (
          <div className="rounded-xl border border-ink-200 bg-white p-6 shadow-sm">
            <EmptyState title="Invite link invalid or expired" description="Ask an admin on your team to send you a new invite." />
          </div>
        )}

        {token && inviteQuery.data && (
          <div className="rounded-xl border border-ink-200 bg-white p-6 shadow-sm">
            <h1 className="text-lg font-semibold text-ink-900">Join {inviteQuery.data.workspaceName}</h1>
            <p className="mt-1 text-sm text-ink-500">
              {inviteQuery.data.name} · {inviteQuery.data.email} · invited as {ROLE_LABELS[inviteQuery.data.role] ?? inviteQuery.data.role}
            </p>
            <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-4">
              <Input
                label="Choose a password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
                hint="At least 8 characters, with an uppercase letter, a lowercase letter, and a number."
              />
              <Button type="submit" loading={status === 'loading'} className="mt-1 w-full justify-center">
                Set password &amp; join workspace
              </Button>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
