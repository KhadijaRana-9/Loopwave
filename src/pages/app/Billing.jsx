import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Check, Download } from 'lucide-react'
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

const STATUS_TONE = { paid: 'success', upcoming: 'warning', failed: 'danger' }

export default function Billing() {
  const [pendingPlan, setPendingPlan] = useState(null)
  const queryClient = useQueryClient()

  const subscriptionQuery = useQuery({ queryKey: ['subscription'], queryFn: billingService.getCurrentSubscription })
  const plansQuery = useQuery({ queryKey: ['plans'], queryFn: billingService.listPlans })
  const invoicesQuery = useQuery({ queryKey: ['invoices'], queryFn: billingService.listInvoices })

  const changePlanMutation = useMutation({
    mutationFn: billingService.changePlan,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['subscription'] })
      setPendingPlan(null)
      toast.success(`Switched to ${result.plan.name} plan`)
    },
  })

  const invoices = invoicesQuery.data ?? []
  const { page, pageCount, pageSize, totalItems, pageItems, setPage, setPageSize } = usePagination(invoices, 5)

  if (subscriptionQuery.isLoading || plansQuery.isLoading || invoicesQuery.isLoading) return <Spinner label="Loading billing..." />

  const subscription = subscriptionQuery.data
  const plans = plansQuery.data

  const limitsNearCap = PLAN_LIMIT_KEYS.filter((limit) => usagePercent(subscription.usage[limit.key], subscription.plan.limits[limit.key]) >= 85)
  const nextPlan = plans.find((p) => p.price !== null && p.price > (subscription.plan.price ?? 0))

  const invoiceColumns = [
    { key: 'number', header: 'Invoice' },
    { key: 'issuedAt', header: 'Date', render: (r) => new Date(r.issuedAt).toLocaleDateString() },
    { key: 'amount', header: 'Amount', render: (r) => `₹${r.amount.toLocaleString()}` },
    { key: 'status', header: 'Status', render: (r) => <Badge tone={STATUS_TONE[r.status]}>{r.status}</Badge> },
    {
      key: 'actions',
      header: '',
      render: () => (
        <button className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100" onClick={() => toast.info('Demo: connect a payment provider to generate real invoice PDFs.')} aria-label="Download invoice">
          <Download className="h-4 w-4" />
        </button>
      ),
    },
  ]

  return (
    <div>
      <PageHeader title="Billing & subscription" description="No real payment provider is connected yet — plan changes below are simulated." />

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
            description={`Renews ${new Date(subscription.renewsAt).toLocaleDateString()}`}
            action={<Badge tone="brand">{subscription.status}</Badge>}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {PLAN_LIMIT_KEYS.map((limit) => (
              <UsageMeter key={limit.key} label={limit.label} used={subscription.usage[limit.key]} limit={subscription.plan.limits[limit.key]} />
            ))}
          </div>
        </Card>
        <Card>
          <CardHeader title="Payment status" />
          <p className="text-sm text-ink-500">No payment method on file (demo).</p>
          <Button variant="outline" size="sm" className="mt-3 w-full justify-center" onClick={() => toast.info('Demo: connect Stripe/Razorpay to add a payment method.')}>
            Add payment method
          </Button>
        </Card>
      </div>

      <h2 className="mb-4 mt-8 text-sm font-semibold text-ink-900">Compare plans</h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-5">
        {plans.map((plan) => {
          const isCurrent = plan.id === subscription.plan.id
          return (
            <div key={plan.id} className={clsx('flex flex-col rounded-xl border bg-white p-5', plan.highlighted ? 'border-brand-500 ring-1 ring-brand-500' : 'border-ink-200')}>
              <h3 className="text-sm font-semibold text-ink-900">{plan.name}</h3>
              <div className="mt-2">
                {plan.price === null ? (
                  <span className="text-xl font-semibold text-ink-900">Custom</span>
                ) : (
                  <>
                    <span className="text-xl font-semibold text-ink-900">₹{plan.price.toLocaleString()}</span>
                    <span className="text-xs text-ink-500">/mo</span>
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
      <Table columns={invoiceColumns} data={pageItems} />
      <Pagination page={page} pageCount={pageCount} pageSize={pageSize} totalItems={totalItems} onPageChange={setPage} onPageSizeChange={setPageSize} pageSizeOptions={[5, 10, 25]} />

      <ConfirmDialog
        open={!!pendingPlan}
        onClose={() => setPendingPlan(null)}
        onConfirm={() => changePlanMutation.mutate(pendingPlan.id)}
        title={`Switch to ${pendingPlan?.name}?`}
        description="This is simulated in the demo build — no real charge is made."
        confirmLabel="Confirm switch"
        tone="primary"
        loading={changePlanMutation.isPending}
      />
    </div>
  )
}
