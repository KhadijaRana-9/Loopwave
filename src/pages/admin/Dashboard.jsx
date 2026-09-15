import { useQuery } from '@tanstack/react-query'
import { Building2, CreditCard, TrendingUp, Users } from 'lucide-react'
import PageHeader from '@/components/ui/PageHeader'
import StatCard from '@/components/ui/StatCard'
import Card, { CardHeader } from '@/components/ui/Card'
import Table from '@/components/ui/Table'
import Badge from '@/components/ui/Badge'
import Spinner from '@/components/ui/Spinner'
import * as adminService from '@/services/adminService'

const STATUS_TONE = { active: 'success', trial: 'info', suspended: 'danger' }

export default function AdminDashboard() {
  const dashboardQuery = useQuery({ queryKey: ['admin-dashboard'], queryFn: adminService.getPlatformDashboard })
  const tenantsQuery = useQuery({ queryKey: ['admin-tenants'], queryFn: adminService.listTenants })

  if (dashboardQuery.isLoading || tenantsQuery.isLoading) return <Spinner label="Loading platform data..." />

  const stats = dashboardQuery.data
  const tenants = tenantsQuery.data

  const columns = [
    { key: 'name', header: 'Business' },
    { key: 'plan', header: 'Plan', render: (r) => r.plan?.name ?? '—' },
    { key: 'status', header: 'Status', render: (r) => <Badge tone={STATUS_TONE[r.status]}>{r.status}</Badge> },
    { key: 'mrr', header: 'MRR', render: (r) => `₹${r.mrr.toLocaleString()}` },
  ]

  return (
    <div>
      <PageHeader title="Platform overview" description="Demo data — connect a backend for real tenant and revenue figures." />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total businesses" value={stats.totalBusinesses} icon={Building2} />
        <StatCard label="Active businesses" value={stats.activeBusinesses} icon={Building2} />
        <StatCard label="Trial businesses" value={stats.trialBusinesses} icon={Users} />
        <StatCard label="MRR" value={`₹${stats.mrr.toLocaleString()}`} icon={TrendingUp} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard label="Paid businesses" value={stats.paidBusinesses} icon={CreditCard} />
        <StatCard label="Suspended businesses" value={stats.suspendedBusinesses} icon={Building2} />
      </div>

      <Card className="mt-6" padded={false}>
        <div className="p-5 pb-0">
          <CardHeader title="Recent tenants" />
        </div>
        <Table columns={columns} data={tenants.slice(0, 6)} />
      </Card>
    </div>
  )
}
