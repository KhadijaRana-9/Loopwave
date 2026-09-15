import { useQuery } from '@tanstack/react-query'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import PageHeader from '@/components/ui/PageHeader'
import Card, { CardHeader } from '@/components/ui/Card'
import Spinner from '@/components/ui/Spinner'
import * as adminService from '@/services/adminService'
import { getPlanById } from '@/constants/plans'

export default function AdminUsage() {
  const tenantsQuery = useQuery({ queryKey: ['admin-tenants'], queryFn: adminService.listTenants })
  if (tenantsQuery.isLoading) return <Spinner label="Loading usage..." />

  const byPlan = {}
  tenantsQuery.data.forEach((t) => {
    byPlan[t.planId] = (byPlan[t.planId] ?? 0) + 1
  })
  const chartData = Object.entries(byPlan).map(([planId, count]) => ({
    plan: getPlanById(planId)?.name ?? planId,
    count,
  }))

  return (
    <div>
      <PageHeader title="Platform usage" description="Distribution of tenants across plans" />
      <Card>
        <CardHeader title="Tenants by plan" />
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eef0f4" />
            <XAxis dataKey="plan" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="count" fill="#4a63f7" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>
    </div>
  )
}
