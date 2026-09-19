import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts'
import { MessageSquare, Users, Inbox as InboxIcon, TrendingUp, Bot, Megaphone } from 'lucide-react'
import PageHeader from '@/components/ui/PageHeader'
import StatCard from '@/components/ui/StatCard'
import Card, { CardHeader } from '@/components/ui/Card'
import { Select } from '@/components/ui/Input'
import Spinner from '@/components/ui/Spinner'
import UsageMeter from '@/components/ui/UsageMeter'
import { listContacts } from '@/services/contactsService'
import { listConversations } from '@/services/conversationsService'
import { listCampaigns } from '@/services/campaignsService'
import { getMessagingAnalytics } from '@/services/analyticsService'
import { getCurrentSubscription } from '@/services/billingService'
import { PLAN_LIMIT_KEYS } from '@/constants/plans'
import { useAuthStore } from '@/store/authStore'

export default function Dashboard() {
  const [days, setDays] = useState(14)
  const user = useAuthStore((s) => s.user)
  const navigate = useNavigate()

  const contactsQuery = useQuery({ queryKey: ['contacts'], queryFn: () => listContacts() })
  const conversationsQuery = useQuery({ queryKey: ['conversations'], queryFn: () => listConversations() })
  const campaignsQuery = useQuery({ queryKey: ['campaigns'], queryFn: () => listCampaigns() })
  const messagingQuery = useQuery({ queryKey: ['analytics', 'messaging', days], queryFn: () => getMessagingAnalytics({ days }) })
  const subscriptionQuery = useQuery({ queryKey: ['subscription'], queryFn: getCurrentSubscription })

  const loading =
    contactsQuery.isLoading || conversationsQuery.isLoading || campaignsQuery.isLoading || messagingQuery.isLoading || subscriptionQuery.isLoading

  if (loading) return <Spinner label="Loading dashboard..." />

  const contacts = contactsQuery.data ?? []
  const conversations = conversationsQuery.data ?? []
  const campaigns = campaignsQuery.data ?? []
  const messaging = messagingQuery.data
  const subscription = subscriptionQuery.data

  const newLeads = contacts.filter((c) => c.leadStatus === 'new').length
  const activeConversations = conversations.filter((c) => c.status !== 'resolved').length
  const unread = conversations.reduce((sum, c) => sum + (c.unread || 0), 0)
  const runningCampaigns = campaigns.filter((c) => c.status === 'running').length
  const totalSent = campaigns.reduce((sum, c) => sum + c.sent, 0)
  const totalConverted = campaigns.reduce((sum, c) => sum + c.converted, 0)
  const conversionRate = totalSent ? ((totalConverted / totalSent) * 100).toFixed(1) : '0.0'

  const chartData = messaging.sent.map((point, i) => ({
    date: point.date.slice(5),
    sent: point.value,
    delivered: messaging.delivered[i].value,
    read: messaging.read[i].value,
  }))

  return (
    <div>
      <PageHeader
        title={`Welcome back, ${user?.name?.split(' ')[0]}`}
        description="Here's how your workspace is performing."
        action={
          <Select aria-label="Date range" value={days} onChange={(e) => setDays(Number(e.target.value))} className="w-40">
            <option value={7}>Last 7 days</option>
            <option value={14}>Last 14 days</option>
            <option value={30}>Last 30 days</option>
          </Select>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total contacts" value={contacts.length.toLocaleString()} icon={Users} onClick={() => navigate('/app/contacts')} />
        <StatCard label="New leads" value={newLeads} icon={TrendingUp} onClick={() => navigate('/app/contacts?status=new')} />
        <StatCard
          label="Active conversations"
          value={activeConversations}
          icon={InboxIcon}
          hint={`${unread} unread`}
          onClick={() => navigate('/app/inbox?status=open')}
        />
        <StatCard label="Running campaigns" value={runningCampaigns} icon={Megaphone} hint={`${campaigns.length} total`} onClick={() => navigate('/app/campaigns')} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Delivery rate" value={`${messaging.deliveryRate}%`} icon={MessageSquare} onClick={() => navigate('/app/analytics?tab=messaging')} />
        <StatCard label="Read rate" value={`${messaging.readRate}%`} icon={MessageSquare} onClick={() => navigate('/app/analytics?tab=messaging')} />
        <StatCard label="Reply rate" value={`${messaging.replyRate}%`} icon={MessageSquare} onClick={() => navigate('/app/analytics?tab=messaging')} />
        <StatCard label="Conversion rate" value={`${conversionRate}%`} icon={TrendingUp} onClick={() => navigate('/app/analytics?tab=campaigns')} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Messaging volume" description="Sent vs. delivered vs. read" />
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="sent" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4a63f7" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#4a63f7" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef0f4" />
              <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#737d92' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: '#737d92' }} axisLine={false} tickLine={false} />
              <Tooltip />
              <Area type="monotone" dataKey="sent" stroke="#4a63f7" fill="url(#sent)" strokeWidth={2} />
              <Area type="monotone" dataKey="read" stroke="#16a34a" fill="transparent" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <CardHeader title={`${subscription.plan.name} plan usage`} />
          <div className="flex flex-col gap-4">
            {PLAN_LIMIT_KEYS.slice(0, 4).map((limit) => (
              <UsageMeter
                key={limit.key}
                label={limit.label}
                used={subscription.usage[limit.key]}
                limit={subscription.plan.limits[limit.key]}
              />
            ))}
          </div>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <StatCard
          label="AI replies this month"
          value={subscription.usage.aiUsage.toLocaleString()}
          icon={Bot}
          hint="Handled without human intervention"
          onClick={() => navigate('/app/analytics?tab=ai')}
        />
        <StatCard
          label="Team activity"
          value={`${conversations.filter((c) => c.assignedAgentId).length} assigned`}
          icon={Users}
          hint="conversations currently assigned to an agent"
          onClick={() => navigate('/app/team')}
        />
      </div>
    </div>
  )
}
