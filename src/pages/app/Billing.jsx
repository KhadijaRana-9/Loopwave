import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Check, CreditCard, Download } from 'lucide-react'
import clsx from 'clsx'
import PageHeader from '@/components/ui/PageHeader'
import Card, { CardHeader } from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Table from '@/components/ui/Table'
import Pagination from '@/components/ui/Pagination'
import UsageMeter from '@/components/ui/UsageMeter'
import Spinner from '@/components/ui/Spinner'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { toast } from '@/store/toastStore'
import { usePagination } from '@/hooks/usePagination'
import * as billingService from '@/services/billingService'
import { PLAN_LIMIT_KEYS, formatLimit, usagePercent } from '@/constants/plans'

const STATUS_TONE = { paid: 'success', upcoming: 'warning', failed: 'danger', void: 'neutral' }
const SUB_STATUS_TONE = { active: 'success', trialing: 'brand', past_due: 'warning', cancelled: 'danger' }
const YEARLY_MONTHS = 10 // 2 months free — mirrors server/src/integrations/payments.adapter.ts

export default function Billing() {
  const [pendingPlan, setPendingPlan] = useState(null)
  const [period, setPeriod] = useState('monthly')
  const [cancelOpen, setCancelOpen] = useState(false)
  const queryClient = useQueryClient()

  const subscriptionQuery = useQuery({ queryKey: ['subscription'], queryFn: billingService.getCurrentSubscription })
  const plansQuery = useQuery({ queryKey: ['plans'], queryFn: billingService.listPlans })
  const invoicesQuery = useQuery({ queryKey: ['invoices'], queryFn: billingService.listInvoices })
  const paymentMethodQuery = useQuery({
    queryKey: ['payment-method'],
    queryFn: billingService.getPaymentMethod,
    enabled: !!subscriptionQuery.data && !subscriptionQuery.data.sandbox,
  })

  const changePlanMutation = useMutation({
    mutationFn: ({ planId, billingCycle }) => billingService.changePlan(planId, billingCycle),
    onSuccess: (result) => {
      setPendingPlan(null)
      if (result.checkoutUrl) return // redirecting to Stripe Checkout — nothing to activate yet
      queryClient.invalidateQueries({ queryKey: ['subscription'] })
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      toast.success(`Switched to ${result.plan.name} plan`)
    },
  })

  const cancelMutation = useMutation({
    mutationFn: billingService.cancelSubscription,
    onSuccess: (result) => {
      setCancelOpen(false)
      queryClient.invalidateQueries({ queryKey: ['subscription'] })
      toast.success(result.immediate ? 'Subscription cancelled' : `Subscription will end on ${new Date(result.renewsAt).toLocaleDateString()}`)
    },
  })

  const resumeMutation = useMutation({
    mutationFn: billingService.resumeSubscription,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription'] })
      toast.success('Subscription resumed')
    },
  })

  const invoices = invoicesQuery.data ?? []
  const { page, pageCount, pageSize, totalItems, pageItems, setPage, setPageSize } = usePagination(invoices, 5)

  if (subscriptionQuery.isLoading || plansQuery.isLoading || invoicesQuery.isLoading) return <Spinner label="Loading billing..." />

  const subscription = subscriptionQuery.data
  const plans = plansQuery.data
  const paymentMethod = paymentMethodQuery.data

  const limitsNearCap = PLAN_LIMIT_KEYS.filter((limit) => usagePercent(subscription.usage[limit.key], subscription.plan.limits[limit.key]) >= 85)
  const nextPlan = plans.find((p) => p.price !== null && p.price > (subscription.plan.price ?? 0))
  const priceFor = (plan) => (plan.price === null ? null : period === 'yearly' ? plan.price * YEARLY_MONTHS : plan.price)

  const invoiceColumns = [
    { key: 'number', header: 'Invoice' },
    { key: 'issuedAt', header: 'Date', render: (r) => new Date(r.issuedAt).toLocaleDateString() },
    { key: 'amount', header: 'Amount', render: (r) => `₹${r.amount.toLocaleString()}` },
    { key: 'status', header: 'Status', render: (r) => <Badge tone={STATUS_TONE[r.status]}>{r.status}</Badge> },
    {
      key: 'actions',
      header: '',
      render: () => (
        <button
          className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100"
          onClick={() => toast.info(subscription.sandbox ? 'Demo: connect Stripe to generate real invoice PDFs.' : 'Invoice PDF download coming soon — view full history in your Stripe customer portal.')}
          aria-label="Download invoice"
        >
          <Download className="h-4 w-4" />
        </button>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Billing & subscription"
        description={
          subscription.sandbox
            ? 'No real payment provider is connected yet — plan changes below are simulated, no real charge is made.'
            : 'Billed via Stripe. Plan changes take effect once payment is confirmed.'
        }
      />

      {subscription.status === 'past_due' && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-danger-100 bg-danger-100/40 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-danger-500" />
          <div>
            <p className="text-sm font-medium text-ink-900">Your last payment failed.</p>
            <p className="text-xs text-ink-500">Update your payment method to avoid losing access to {subscription.plan.name} features.</p>
          </div>
        </div>
      )}

      {subscription.cancelAtPeriodEnd && subscription.renewsAt && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warning-100 bg-warning-100/40 p-4">
          <div>
            <p className="text-sm font-medium text-ink-900">Your subscription is cancelled and will end on {new Date(subscription.renewsAt).toLocaleDateString()}.</p>
            <p className="text-xs text-ink-500">You'll keep {subscription.plan.name} access until then.</p>
          </div>
          <Button size="sm" variant="outline" loading={resumeMutation.isPending} onClick={() => resumeMutation.mutate()}>
            Resume subscription
          </Button>
        </div>
      )}

      {limitsNearCap.length > 0 && nextPlan && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warning-100 bg-warning-100/40 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning-500" />
            <div>
              <p className="text-sm font-medium text-ink-900">
                You're close to your {subscription.plan.name} plan limit on {limitsNearCap.map((l) => l.label.toLowerCase()).join(', ')}.
              </p>
              <p className="text-xs text-ink-500">Upgrade to {nextPlan.name} for higher limits before you hit a hard cap.</p>
            </div>
          </div>
          <Button size="sm" onClick={() => setPendingPlan(nextPlan)}>
            Upgrade to {nextPlan.name}
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title={`${subscription.plan.name} plan`}
            description={subscription.renewsAt ? `Renews ${new Date(subscription.renewsAt).toLocaleDateString()}` : 'No renewal date yet'}
            action={<Badge tone={SUB_STATUS_TONE[subscription.status] ?? 'neutral'}>{subscription.status.replace('_', ' ')}</Badge>}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {PLAN_LIMIT_KEYS.map((limit) => (
              <UsageMeter key={limit.key} label={limit.label} used={subscription.usage[limit.key]} limit={subscription.plan.limits[limit.key]} />
            ))}
          </div>
          {subscription.status !== 'cancelled' && !subscription.cancelAtPeriodEnd && subscription.plan.price > 0 && (
            <button className="mt-4 text-xs font-medium text-danger-500 hover:underline" onClick={() => setCancelOpen(true)}>
              Cancel subscription
            </button>
          )}
        </Card>
        <Card>
          <CardHeader title="Payment method" />
          {subscription.sandbox ? (
            <>
              <p className="text-sm text-ink-500">No payment method on file (demo).</p>
              <Button variant="outline" size="sm" className="mt-3 w-full justify-center" onClick={() => toast.info('Demo: connect Stripe/Razorpay to add a payment method.')}>
                Add payment method
              </Button>
            </>
          ) : paymentMethodQuery.isLoading ? (
            <p className="text-sm text-ink-500">Loading…</p>
          ) : paymentMethod ? (
            <div className="flex items-center gap-3">
              <CreditCard className="h-8 w-8 shrink-0 text-ink-400" />
              <div>
                <p className="text-sm font-medium capitalize text-ink-900">
                  {paymentMethod.brand} •••• {paymentMethod.last4}
                </p>
                <p className="text-xs text-ink-500">
                  Expires {String(paymentMethod.expMonth).padStart(2, '0')}/{paymentMethod.expYear}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-ink-500">No payment method on file.</p>
          )}
        </Card>
      </div>

      <div className="mb-4 mt-8 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink-900">Compare plans</h2>
        <div className="flex items-center gap-1 rounded-lg border border-ink-200 bg-white p-1">
          {['monthly', 'yearly'].map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={clsx('rounded-md px-3 py-1 text-xs font-medium capitalize transition-colors', period === p ? 'bg-brand-500 text-white' : 'text-ink-500 hover:text-ink-900')}
            >
              {p}
              {p === 'yearly' && <span className="ml-1 text-[10px] opacity-80">2 months free</span>}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-5">
        {plans.map((plan) => {
          const isCurrent = plan.id === subscription.plan.id && subscription.billingCycle === period
          const price = priceFor(plan)
          return (
            <div key={plan.id} className={clsx('flex flex-col rounded-xl border bg-white p-5', plan.highlighted ? 'border-brand-500 ring-1 ring-brand-500' : 'border-ink-200')}>
              <h3 className="text-sm font-semibold text-ink-900">{plan.name}</h3>
              <div className="mt-2">
                {price === null ? (
                  <span className="text-xl font-semibold text-ink-900">Custom</span>
                ) : (
                  <>
                    <span className="text-xl font-semibold text-ink-900">₹{price.toLocaleString()}</span>
                    <span className="text-xs text-ink-500">/{period === 'yearly' ? 'yr' : 'mo'}</span>
                  </>
                )}
              </div>
              <ul className="my-4 flex-1 space-y-1.5 text-xs text-ink-600">
                {PLAN_LIMIT_KEYS.slice(0, 4).map((limit) => (
                  <li key={limit.key} className="flex items-center gap-1.5">
                    <Check className="h-3.5 w-3.5 text-success-500" /> {formatLimit(plan.limits[limit.key])} {limit.label.toLowerCase()}
                  </li>
                ))}
              </ul>
              <Button
                variant={isCurrent ? 'outline' : 'primary'}
                size="sm"
                className="w-full justify-center"
                disabled={isCurrent || plan.price === null}
                onClick={() => setPendingPlan(plan)}
              >
                {isCurrent ? 'Current plan' : plan.price === null ? 'Contact sales' : 'Switch plan'}
              </Button>
            </div>
          )
        })}
      </div>

      <h2 className="mb-4 mt-8 text-sm font-semibold text-ink-900">Billing history</h2>
      <Table columns={invoiceColumns} data={pageItems} emptyTitle="No payments yet" emptyDescription="Your billing history will appear here after your first payment." />
      <Pagination page={page} pageCount={pageCount} pageSize={pageSize} totalItems={totalItems} onPageChange={setPage} onPageSizeChange={setPageSize} pageSizeOptions={[5, 10, 25]} />

      <ConfirmDialog
        open={!!pendingPlan}
        onClose={() => setPendingPlan(null)}
        onConfirm={() => changePlanMutation.mutate({ planId: pendingPlan.id, billingCycle: period })}
        title={`Switch to ${pendingPlan?.name}?`}
        description={
          subscription.sandbox
            ? 'This is simulated in the demo build — no real charge is made.'
            : `You'll be redirected to Stripe to complete a ${period} payment. Your plan changes only after payment is confirmed.`
        }
        confirmLabel="Confirm switch"
        tone="primary"
        loading={changePlanMutation.isPending}
      />

      <ConfirmDialog
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        onConfirm={() => cancelMutation.mutate()}
        title="Cancel subscription?"
        description={
          subscription.sandbox
            ? 'Demo mode has no real billing period to honor, so this cancels immediately and reverts you to the Free Trial plan.'
            : "You'll keep access until the end of your current billing period, then move to the Free Trial plan. You can resume any time before then."
        }
        confirmLabel="Cancel subscription"
        tone="danger"
        loading={cancelMutation.isPending}
      />
    </div>
  )
}
