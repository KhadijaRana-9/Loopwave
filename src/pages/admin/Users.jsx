import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import PageHeader from '@/components/ui/PageHeader'
import Table from '@/components/ui/Table'
import Pagination from '@/components/ui/Pagination'
import Badge from '@/components/ui/Badge'
import Avatar from '@/components/ui/Avatar'
import Spinner from '@/components/ui/Spinner'
import { Input } from '@/components/ui/Input'
import { usePagination } from '@/hooks/usePagination'
import { ROLE_LABELS } from '@/constants/roles'
import * as adminService from '@/services/adminService'

export default function AdminUsers() {
  const [search, setSearch] = useState('')
  const usersQuery = useQuery({ queryKey: ['admin-users'], queryFn: adminService.listPlatformUsers })

  const users = (usersQuery.data ?? []).filter(
    (u) => u.name.toLowerCase().includes(search.toLowerCase()) || u.tenantName.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase()),
  )
  const { page, pageCount, pageSize, totalItems, pageItems, setPage, setPageSize } = usePagination(users, 10)

  if (usersQuery.isLoading) return <Spinner label="Loading users..." />

  const columns = [
    {
      key: 'name',
      header: 'User',
      render: (r) => (
        <div className="flex items-center gap-2.5">
          <Avatar name={r.name} size={30} />
          <div>
            <div className="font-medium text-ink-900">{r.name}</div>
            <div className="text-xs text-ink-500">{r.email}</div>
          </div>
        </div>
      ),
    },
    { key: 'tenantName', header: 'Business' },
    { key: 'role', header: 'Role', render: (r) => <Badge tone="brand">{ROLE_LABELS[r.role]}</Badge> },
    { key: 'status', header: 'Status', render: (r) => <Badge tone={r.status === 'active' ? 'success' : 'warning'}>{r.status}</Badge> },
  ]

  return (
    <div>
      <PageHeader title="Users" description="Every user across every tenant on the platform" />
      <Input placeholder="Search by name, business or email" value={search} onChange={(e) => setSearch(e.target.value)} className="mb-4 w-72" />
      <Table columns={columns} data={pageItems} rowKey="id" emptyTitle="No users match your search" emptyDescription="Try a different name, business or email." />
      <Pagination page={page} pageCount={pageCount} pageSize={pageSize} totalItems={totalItems} onPageChange={setPage} onPageSizeChange={setPageSize} />
    </div>
  )
}
