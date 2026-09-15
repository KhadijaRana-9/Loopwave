import { useQuery } from '@tanstack/react-query'
import PageHeader from '@/components/ui/PageHeader'
import Table from '@/components/ui/Table'
import Badge from '@/components/ui/Badge'
import StatCard from '@/components/ui/StatCard'
import Spinner from '@/components/ui/Spinner'
import * as adminService from '@/services/adminService'

const STATUS_TONE = { active: 'success', trial: 'info', suspended: 'danger' }

export default function AdminSubscriptions() {
  const tenantsQuery = useQuery({ queryKey: ['admin-tenants'], queryFn: adminService.listTenants })
  if (tenantsQuery.isLoading) return <Spinner label="Loading subscriptions..." />
  const tenants = tenantsQuery.data

  const activeCount = tenants.filter((t) => t.status === 'active').length
  const trialCount = tenants.filter((t) => t.status === 'trial').length
  const mrr = tenants.reduce((sum, t) => sum + t.mrr, 0)
  const arpa = activeCount ? Math.round(mrr / activeCount) : 0

  const columns = [
    { key: 'name', header: 'Business' },
    { key: 'plan', header: 'Plan', render: (r) => r.plan?.name ?? '—' },
    { key: 'status', header: 'Status', render: (r) => <Badge tone={STATUS_TONE[r.status]}>{r.status}</Badge> },
    { key: 'mrr', header: 'MRR', render: (r) => `₹${r.mrr.toLocaleString()}` },
  ]

  return (
    <div>
      <PageHeader title="Subscriptions" description="Revenue and subscription status across all tenants" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Active subscriptions" value={activeCount} />
        <StatCard label="Trials in progress" value={trialCount} />
        <StatCard label="MRR" value={`₹${mrr.toLocaleString()}`} />
        <StatCard label="ARPA" value={`₹${arpa.toLocaleString()}`} hint="Average revenue per active account" />
      </div>
      <div className="mt-6">
        <Table columns={columns} data={tenants} />
      </div>
    </div>
  )
}
