import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ShieldCheck } from 'lucide-react'
import Logo from '@/components/Logo'
import Button from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useAuthStore } from '@/store/authStore'
import { toast } from '@/store/toastStore'

export default function AdminLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const loginAsSuperAdmin = useAuthStore((s) => s.loginAsSuperAdmin)
  const status = useAuthStore((s) => s.status)
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    try {
      await loginAsSuperAdmin({ email, password })
      navigate('/admin/dashboard', { replace: true })
    } catch (err) {
      toast.error(err.message || 'Invalid platform admin credentials.')
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
        <div className="rounded-xl border border-ink-200 bg-white p-6 shadow-sm">
          <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-ink-900/5 text-ink-900">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <h1 className="text-lg font-semibold text-ink-900">Platform Admin Access</h1>
          <p className="mt-1 text-sm text-ink-500">
            Sign in with your Super Admin credentials to manage tenants, plans and system-wide settings.
          </p>
          <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-4">
            <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
            <Button type="submit" loading={status === 'loading'} className="mt-1 w-full justify-center">
              Sign in
            </Button>
          </form>
        </div>
        <p className="mt-5 text-center text-sm text-ink-500">
          <Link to="/login" className="font-medium text-brand-600 hover:underline">
            Back to business login
          </Link>
        </p>
      </div>
    </div>
  )
}
