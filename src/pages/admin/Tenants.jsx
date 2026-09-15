import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import PageHeader from '@/components/ui/PageHeader'
import Table from '@/components/ui/Table'
import Pagination from '@/components/ui/Pagination'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Drawer from '@/components/ui/Drawer'
import Spinner from '@/components/ui/Spinner'
import UsageMeter from '@/components/ui/UsageMeter'
import { Input, Select } from '@/components/ui/Input'
import { usePagination } from '@/hooks/usePagination'
import * as adminService from '@/services/adminService'
import { PLANS, PLAN_LIMIT_KEYS } from '@/constants/plans'

const STATUS_TONE = { active: 'success', trial: 'info', suspended: 'danger' }

export default function Tenants() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [planFilter, setPlanFilter] = useState('all')
  const [activeTenant, setActiveTenant] = useState(null)
  const queryClient = useQueryClient()

  const tenantsQuery = useQuery({ queryKey: ['admin-tenants'], queryFn: adminService.listTenants })
  const usageQuery = useQuery({
    queryKey: ['admin-tenant-usage', activeTenant?.id],
    queryFn: () => adminService.getTenantUsage(activeTenant.id),
    enabled: !!activeTenant,
  })

  const statusMutation = useMutation({
    mutationFn: ({ id, status }) => adminService.setTenantStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-tenants'] })
      setActiveTenant(null)
    },
  })

  const tenants = (tenantsQuery.data ?? []).filter((t) => {
    const matchesSearch = t.name.toLowerCase().includes(search.toLowerCase())
    const matchesStatus = statusFilter === 'all' || t.status === statusFilter
    const matchesPlan = planFilter === 'all' || t.planId === planFilter
    return matchesSearch && matchesStatus && matchesPlan
  })
  const { page, pageCount, pageSize, totalItems, pageItems, setPage, setPageSize } = usePagination(tenants, 10)

  if (tenantsQuery.isLoading) return <Spinner label="Loading tenants..." />

  const columns = [
    { key: 'name', header: 'Business', render: (r) => <span className="font-medium text-ink-900">{r.name}</span> },
    { key: 'plan', header: 'Plan', render: (r) => r.plan?.name ?? '—' },
    { key: 'status', header: 'Status', render: (r) => <Badge tone={STATUS_TONE[r.status]}>{r.status}</Badge> },
    { key: 'users', header: 'Users' },
    { key: 'mrr', header: 'MRR', render: (r) => `₹${r.mrr.toLocaleString()}` },
    { key: 'createdAt', header: 'Joined', render: (r) => new Date(r.createdAt).toLocaleDateString() },
  ]

  return (
    <div>
      <PageHeader title="Tenants" description={`${tenants.length} businesses on the platform`} />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Input placeholder="Search businesses" value={search} onChange={(e) => setSearch(e.target.value)} className="w-64" />
        <Select aria-label="Filter by status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-40">
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="trial">Trial</option>
          <option value="suspended">Suspended</option>
        </Select>
        <Select aria-label="Filter by plan" value={planFilter} onChange={(e) => setPlanFilter(e.target.value)} className="w-40">
          <option value="all">All plans</option>
          {PLANS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      </div>

      <Table columns={columns} data={pageItems} onRowClick={setActiveTenant} emptyTitle="No tenants match your filters" emptyDescription="Try a different search term, status or plan." />
      <Pagination page={page} pageCount={pageCount} pageSize={pageSize} totalItems={totalItems} onPageChange={setPage} onPageSizeChange={setPageSize} />

      <Drawer open={!!activeTenant} onClose={() => setActiveTenant(null)} title={activeTenant?.name}>
        {activeTenant && (
          <div className="flex flex-col gap-5">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-xs text-ink-500">Plan</div>
                <div className="font-medium text-ink-900">{activeTenant.plan?.name}</div>
              </div>
              <div>
                <div className="text-xs text-ink-500">Status</div>
                <Badge tone={STATUS_TONE[activeTenant.status]}>{activeTenant.status}</Badge>
              </div>
              <div>
                <div className="text-xs text-ink-500">Users</div>
                <div className="font-medium text-ink-900">{activeTenant.users}</div>
              </div>
              <div>
                <div className="text-xs text-ink-500">MRR</div>
                <div className="font-medium text-ink-900">₹{activeTenant.mrr.toLocaleString()}</div>
              </div>
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between text-xs font-medium text-ink-500">
                <span>Usage vs plan limits</span>
              </div>
              {usageQuery.isLoading ? (
                <Spinner label="Loading usage..." />
              ) : (
                <div className="flex flex-col gap-3">
                  {PLAN_LIMIT_KEYS.slice(0, 5).map((limit) => (
                    <UsageMeter key={limit.key} label={limit.label} used={usageQuery.data?.[limit.key] ?? 0} limit={activeTenant.plan?.limits[limit.key] ?? 0} />
                  ))}
                </div>
              )}
            </div>
            <div className="flex gap-2">
              {activeTenant.status !== 'suspended' ? (
                <Button variant="danger" onClick={() => statusMutation.mutate({ id: activeTenant.id, status: 'suspended' })} loading={statusMutation.isPending}>
                  Suspend business
                </Button>
              ) : (
                <Button onClick={() => statusMutation.mutate({ id: activeTenant.id, status: 'active' })} loading={statusMutation.isPending}>
                  Reactivate business
                </Button>
              )}
            </div>
          </div>
        )}
      </Drawer>
    </div>
  )
}
