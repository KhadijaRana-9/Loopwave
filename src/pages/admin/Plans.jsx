import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus } from 'lucide-react'
import PageHeader from '@/components/ui/PageHeader'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import Spinner from '@/components/ui/Spinner'
import { toast } from '@/store/toastStore'
import * as adminService from '@/services/adminService'
import { PLAN_LIMIT_KEYS, formatLimit } from '@/constants/plans'

export default function AdminPlans() {
  const [editingPlan, setEditingPlan] = useState(null)
  const [form, setForm] = useState(null)
  const queryClient = useQueryClient()

  const plansQuery = useQuery({ queryKey: ['admin-plans'], queryFn: adminService.listPlansAdmin })

  const updateMutation = useMutation({
    mutationFn: () => adminService.updatePlan(editingPlan.id, form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-plans'] })
      setEditingPlan(null)
      toast.success('Plan updated — changes apply platform-wide')
    },
  })

  if (plansQuery.isLoading) return <Spinner label="Loading plans..." />
  const plans = plansQuery.data

  function openEdit(plan) {
    setEditingPlan(plan)
    setForm({ name: plan.name, price: plan.price, limits: { ...plan.limits } })
  }

  return (
    <div>
      <PageHeader
        title="Plans"
        description="Edit pricing and limits — changes apply platform-wide"
        action={
          <Button onClick={() => toast.info('Demo: creating brand-new plan tiers needs a connected backend to persist safely.')}>
            <Plus className="h-4 w-4" /> New plan
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-5">
        {plans.map((plan) => (
          <Card key={plan.id}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-ink-900">{plan.name}</h3>
              <button onClick={() => openEdit(plan)} className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100" aria-label={`Edit ${plan.name} plan`}>
                <Pencil className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-2">
              {plan.price === null ? <span className="text-lg font-semibold text-ink-900">Custom</span> : <span className="text-lg font-semibold text-ink-900">₹{plan.price.toLocaleString()}/mo</span>}
            </div>
            <ul className="mt-3 space-y-1 text-xs text-ink-500">
              {PLAN_LIMIT_KEYS.slice(0, 5).map((limit) => (
                <li key={limit.key} className="flex justify-between">
                  <span>{limit.label}</span>
                  <span className="font-medium text-ink-700">{formatLimit(plan.limits[limit.key])}</span>
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>

      <Modal
        open={!!editingPlan}
        onClose={() => setEditingPlan(null)}
        title={`Edit ${editingPlan?.name}`}
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setEditingPlan(null)}>
              Cancel
            </Button>
            <Button loading={updateMutation.isPending} onClick={() => updateMutation.mutate()}>
              Save plan
            </Button>
          </>
        }
      >
        {form && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              <Input label="Plan name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <Input
                label="Price (₹/mo, blank = custom)"
                type="number"
                value={form.price ?? ''}
                onChange={(e) => setForm({ ...form, price: e.target.value === '' ? null : Number(e.target.value) })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              {PLAN_LIMIT_KEYS.map((limit) => (
                <Input
                  key={limit.key}
                  label={`${limit.label} (-1 = unlimited)`}
                  type="number"
                  value={form.limits[limit.key]}
                  onChange={(e) => setForm({ ...form, limits: { ...form.limits, [limit.key]: Number(e.target.value) } })}
                />
              ))}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
