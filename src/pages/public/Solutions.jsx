import { ShoppingBag, Stethoscope, Landmark, GraduationCap, Plane, Home as HomeIcon } from 'lucide-react'

const INDUSTRIES = [
  { icon: ShoppingBag, name: 'Retail & E-commerce', text: 'Recover abandoned carts, send order updates, and run flash-sale campaigns.' },
  { icon: Stethoscope, name: 'Healthcare', text: 'Appointment reminders, intake forms, and secure patient follow-ups.' },
  { icon: Landmark, name: 'Financial services', text: 'Authenticated OTPs, statement delivery, and lead qualification at scale.' },
  { icon: GraduationCap, name: 'Education', text: 'Admissions chatbots, fee reminders, and cohort-wide announcements.' },
  { icon: Plane, name: 'Travel & hospitality', text: 'Booking confirmations, itinerary updates, and concierge-style support.' },
  { icon: HomeIcon, name: 'Real estate', text: 'Lead capture from ads straight into a qualification chatbot and pipeline.' },
]

export default function Solutions() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-3xl font-semibold text-ink-900 sm:text-4xl">Solutions for every industry</h1>
        <p className="mt-3 text-ink-500">Loopwave adapts to how your business already talks to customers.</p>
      </div>
      <div className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {INDUSTRIES.map((item) => (
          <div key={item.name} className="rounded-xl border border-ink-200 bg-white p-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
              <item.icon className="h-5 w-5" />
            </div>
            <h3 className="mt-4 text-sm font-semibold text-ink-900">{item.name}</h3>
            <p className="mt-1.5 text-sm text-ink-500">{item.text}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
