import { Link } from 'react-router-dom'
import { Check } from 'lucide-react'
import clsx from 'clsx'
import Button from '@/components/ui/Button'
import { PLANS, PLAN_LIMIT_KEYS, formatLimit } from '@/constants/plans'

export default function Pricing() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-3xl font-semibold text-ink-900 sm:text-4xl">Simple, usage-based pricing</h1>
        <p className="mt-3 text-ink-500">Start free, upgrade as your conversations and team grow.</p>
      </div>

      <div className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-3 xl:grid-cols-5">
        {PLANS.map((plan) => (
          <div
            key={plan.id}
            className={clsx(
              'flex flex-col rounded-xl border bg-white p-6',
              plan.highlighted ? 'border-brand-500 shadow-md ring-1 ring-brand-500' : 'border-ink-200',
            )}
          >
            {plan.highlighted && (
              <span className="mb-3 inline-block w-fit rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-medium text-brand-700">
                Most popular
              </span>
            )}
            <h3 className="text-sm font-semibold text-ink-900">{plan.name}</h3>
            <p className="mt-1 text-xs text-ink-500">{plan.tagline}</p>
            <div className="mt-4">
              {plan.price === null ? (
                <span className="text-2xl font-semibold text-ink-900">Custom</span>
              ) : (
                <>
                  <span className="text-2xl font-semibold text-ink-900">₹{plan.price.toLocaleString()}</span>
                  <span className="text-sm text-ink-500">/mo</span>
                </>
              )}
            </div>
            <Link to="/signup" className="mt-5">
              <Button variant={plan.highlighted ? 'primary' : 'outline'} className="w-full justify-center">
                {plan.isTrial ? 'Start free trial' : plan.price === null ? 'Contact sales' : 'Choose plan'}
              </Button>
            </Link>
            <ul className="mt-6 space-y-2.5 text-sm text-ink-600">
              {PLAN_LIMIT_KEYS.slice(0, 6).map((limit) => (
                <li key={limit.key} className="flex items-center gap-2">
                  <Check className="h-4 w-4 shrink-0 text-success-500" />
                  {formatLimit(plan.limits[limit.key])} {limit.label.toLowerCase()}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mt-16 overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-ink-200">
              <th className="py-3 pr-4 font-medium text-ink-500">Limit</th>
              {PLANS.map((plan) => (
                <th key={plan.id} className="px-4 py-3 font-medium text-ink-900">
                  {plan.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PLAN_LIMIT_KEYS.map((limit) => (
              <tr key={limit.key} className="border-b border-ink-100">
                <td className="py-3 pr-4 text-ink-600">{limit.label}</td>
                {PLANS.map((plan) => (
                  <td key={plan.id} className="px-4 py-3 text-ink-800">
                    {formatLimit(plan.limits[limit.key])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
