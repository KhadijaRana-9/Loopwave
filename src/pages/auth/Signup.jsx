import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Logo from '@/components/Logo'
import Button from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useAuthStore } from '@/store/authStore'
import { toast } from '@/store/toastStore'

export default function Signup() {
  const [form, setForm] = useState({ workspaceName: '', name: '', email: '', password: '' })
  const signup = useAuthStore((s) => s.signup)
  const status = useAuthStore((s) => s.status)
  const navigate = useNavigate()

  function update(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    try {
      await signup(form)
      navigate('/app/dashboard', { replace: true })
    } catch (err) {
      toast.error(err.message || 'Could not create your workspace. Please try again.')
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-50 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Link to="/">
            <Logo />
          </Link>
        </div>
        <div className="rounded-xl border border-ink-200 bg-white p-6 shadow-sm">
          <h1 className="text-lg font-semibold text-ink-900">Start your free trial</h1>
          <p className="mt-1 text-sm text-ink-500">14 days on the Pro plan. No card required for this demo.</p>
          <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-4">
            <Input label="Business / workspace name" value={form.workspaceName} onChange={update('workspaceName')} required />
            <Input label="Your name" value={form.name} onChange={update('name')} required />
            <Input label="Work email" type="email" value={form.email} onChange={update('email')} required />
            <Input
              label="Password"
              type="password"
              value={form.password}
              onChange={update('password')}
              autoComplete="new-password"
              minLength={8}
              required
              hint="At least 8 characters, with an uppercase letter, a lowercase letter, and a number."
            />
            <Button type="submit" loading={status === 'loading'} className="mt-1 w-full justify-center">
              Create workspace
            </Button>
          </form>
        </div>
        <p className="mt-5 text-center text-sm text-ink-500">
          Already have a workspace?{' '}
          <Link to="/login" className="font-medium text-brand-600 hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  )
}
