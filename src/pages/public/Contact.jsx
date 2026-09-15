import { useState } from 'react'
import { CheckCircle2, Mail, MapPin, Phone } from 'lucide-react'
import Button from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'

export default function Contact() {
  const [form, setForm] = useState({ name: '', email: '', message: '' })
  const [submitted, setSubmitted] = useState(false)
  const [sending, setSending] = useState(false)

  function update(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }))
  }

  function handleSubmit(e) {
    e.preventDefault()
    setSending(true)
    // Demo only — no backend wired up yet. Replace with a real POST to your
    // contact/lead endpoint.
    setTimeout(() => {
      setSending(false)
      setSubmitted(true)
    }, 600)
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="grid grid-cols-1 gap-12 lg:grid-cols-2">
        <div>
          <h1 className="text-3xl font-semibold text-ink-900">Talk to our team</h1>
          <p className="mt-3 text-ink-500">Questions about pricing, migrations, or enterprise needs? We're happy to help.</p>
          <div className="mt-8 space-y-4 text-sm text-ink-600">
            <div className="flex items-center gap-3">
              <Mail className="h-4 w-4 text-ink-400" /> hello@loopwavedemo.com
            </div>
            <div className="flex items-center gap-3">
              <Phone className="h-4 w-4 text-ink-400" /> +91 98765 40000
            </div>
            <div className="flex items-center gap-3">
              <MapPin className="h-4 w-4 text-ink-400" /> Bengaluru, India
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-ink-200 bg-white p-6">
          {submitted ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <CheckCircle2 className="h-10 w-10 text-success-500" />
              <h3 className="mt-3 text-sm font-semibold text-ink-900">Message sent</h3>
              <p className="mt-1 text-sm text-ink-500">This is a demo form — no message was actually delivered.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <Input label="Full name" value={form.name} onChange={update('name')} required />
              <Input label="Email" type="email" value={form.email} onChange={update('email')} required />
              <Textarea label="Message" value={form.message} onChange={update('message')} required />
              <Button type="submit" loading={sending} className="mt-1 w-full justify-center">
                Send message
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
