import { useQuery } from '@tanstack/react-query'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import PageHeader from '@/components/ui/PageHeader'
import StatCard from '@/components/ui/StatCard'
import Card, { CardHeader } from '@/components/ui/Card'
import Spinner from '@/components/ui/Spinner'
import * as adminService from '@/services/adminService'

// Simple deterministic trailing-6-month MRR trend derived from current MRR,
// for illustration until real billing-provider data is wired up.
function buildMrrTrend(currentMrr) {
  return Array.from({ length: 6 }).map((_, i) => {
    const month = new Date()
    month.setMonth(month.getMonth() - (5 - i))
    return { month: month.toLocaleString('default', { month: 'short' }), mrr: Math.round(currentMrr * (0.6 + i * 0.08)) }
  })
}

export default function AdminBilling() {
  const dashboardQuery = useQuery({ queryKey: ['admin-dashboard'], queryFn: adminService.getPlatformDashboard })
  if (dashboardQuery.isLoading) return <Spinner label="Loading billing overview..." />
  const stats = dashboardQuery.data
  const trend = buildMrrTrend(stats.mrr)

  return (
    <div>
      <PageHeader title="Platform billing" description="Revenue overview — connect Stripe for real transaction data." />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="MRR" value={`₹${stats.mrr.toLocaleString()}`} />
        <StatCard label="Paying businesses" value={stats.paidBusinesses} />
        <StatCard label="Trial businesses" value={stats.trialBusinesses} />
      </div>
      <Card className="mt-6">
        <CardHeader title="MRR trend (illustrative)" />
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={trend}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eef0f4" />
            <XAxis dataKey="month" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
            <Tooltip />
            <Area type="monotone" dataKey="mrr" stroke="#4a63f7" fill="#4a63f720" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </Card>
    </div>
  )
}
