import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Download } from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts'
import PageHeader from '@/components/ui/PageHeader'
import Tabs from '@/components/ui/Tabs'
import Card, { CardHeader } from '@/components/ui/Card'
import StatCard from '@/components/ui/StatCard'
import Button from '@/components/ui/Button'
import Spinner from '@/components/ui/Spinner'
import { Select } from '@/components/ui/Input'
import Table from '@/components/ui/Table'
import { toast } from '@/store/toastStore'
import * as analyticsService from '@/services/analyticsService'

const TABS = [
  { value: 'messaging', label: 'Messaging' },
  { value: 'campaigns', label: 'Campaigns' },
  { value: 'contacts', label: 'Contacts' },
  { value: 'leads', label: 'Leads' },
  { value: 'agents', label: 'Agents' },
  { value: 'ai', label: 'AI usage' },
  { value: 'automation', label: 'Automation' },
  { value: 'whatsapp', label: 'WhatsApp usage' },
]

const PIE_COLORS = ['#4a63f7', '#16a34a', '#d97706', '#2563eb', '#9333ea', '#dc2626']

export default function Analytics() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [tab, setTab] = useState(searchParams.get('tab') ?? 'messaging')
  const [days, setDays] = useState(30)

  function changeTab(value) {
    setTab(value)
    setSearchParams({}, { replace: true })
  }

  return (
    <div>
      <PageHeader
        title="Analytics"
        description="Performance across messaging, campaigns, contacts and automation"
        action={
          <div className="flex items-center gap-2">
            <Select aria-label="Date range" value={days} onChange={(e) => setDays(Number(e.target.value))} className="w-40">
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => toast.info('Demo: connect a backend to export real analytics as CSV/PDF.')}
            >
              <Download className="h-4 w-4" /> Export
            </Button>
          </div>
        }
      />
      <Tabs tabs={TABS} active={tab} onChange={changeTab} />
      <div className="mt-5">
        {tab === 'messaging' && <MessagingTab days={days} />}
        {tab === 'campaigns' && <CampaignsTab days={days} />}
        {tab === 'contacts' && <ContactsTab days={days} />}
        {tab === 'leads' && <LeadsTab />}
        {tab === 'agents' && <AgentsTab />}
        {tab === 'ai' && <AiTab days={days} />}
        {tab === 'automation' && <AutomationTab />}
        {tab === 'whatsapp' && <WhatsappTab days={days} />}
      </div>
    </div>
  )
}

function MessagingTab({ days }) {
  const { data, isLoading } = useQuery({ queryKey: ['analytics-messaging', days], queryFn: () => analyticsService.getMessagingAnalytics({ days }) })
  if (isLoading) return <Spinner />
  const chartData = data.sent.map((p, i) => ({ date: p.date.slice(5), sent: p.value, delivered: data.delivered[i].value, read: data.read[i].value }))
  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Delivery rate" value={`${data.deliveryRate}%`} delta={data.deliveryRateChange} deltaTone={data.deliveryRateChange?.startsWith('-') ? 'danger' : 'success'} />
        <StatCard label="Read rate" value={`${data.readRate}%`} delta={data.readRateChange} deltaTone={data.readRateChange?.startsWith('-') ? 'danger' : 'success'} />
        <StatCard label="Reply rate" value={`${data.replyRate}%`} delta={data.replyRateChange} deltaTone={data.replyRateChange?.startsWith('-') ? 'danger' : 'success'} />
      </div>
      <p className="mb-4 mt-1 text-xs text-ink-400">First vs. second half of the selected {days}-day period</p>
      <Card className="mt-4">
        <CardHeader title="Message volume" />
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eef0f4" />
            <XAxis dataKey="date" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
            <Tooltip />
            <Legend />
            <Area type="monotone" dataKey="sent" stroke="#4a63f7" fill="#4a63f720" strokeWidth={2} name="Sent" />
            <Area type="monotone" dataKey="delivered" stroke="#2563eb" fill="transparent" strokeWidth={2} name="Delivered" />
            <Area type="monotone" dataKey="read" stroke="#16a34a" fill="transparent" strokeWidth={2} name="Read" />
          </AreaChart>
        </ResponsiveContainer>
      </Card>
    </>
  )
}

function CampaignsTab({ days }) {
  const { data, isLoading } = useQuery({ queryKey: ['analytics-campaigns', days], queryFn: () => analyticsService.getCampaignAnalytics({ days }) })
  if (isLoading) return <Spinner />
  const columns = [
    { key: 'name', header: 'Campaign' },
    { key: 'converted', header: 'Converted' },
    { key: 'ctr', header: 'CTR', render: (r) => `${r.ctr}%` },
  ]
  return (
    <>
      <StatCard
        label="Overall conversion rate"
        value={`${data.conversionRate}%`}
        delta={data.conversionRateChange}
        deltaTone={data.conversionRateChange?.startsWith('-') ? 'danger' : 'success'}
        className="max-w-xs"
      />
      <Card className="mt-4">
        <CardHeader title="Top performing campaigns" />
        <Table columns={columns} data={data.topCampaigns} rowKey="name" />
      </Card>
    </>
  )
}

function ContactsTab({ days }) {
  const { data, isLoading } = useQuery({ queryKey: ['analytics-contacts', days], queryFn: () => analyticsService.getContactsAnalytics({ days }) })
  if (isLoading) return <Spinner />
  const chartData = data.newContacts.map((p) => ({ date: p.date.slice(5), value: p.value }))
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader title="New contacts over time" />
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eef0f4" />
            <XAxis dataKey="date" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
            <Tooltip />
            <Bar dataKey="value" fill="#4a63f7" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>
      <Card>
        <CardHeader title="Contacts by source" />
        <ResponsiveContainer width="100%" height={260}>
          <PieChart>
            <Pie data={data.bySource} dataKey="value" nameKey="name" innerRadius={60} outerRadius={90} paddingAngle={2}>
              {data.bySource.map((_, i) => (
                <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </Card>
    </div>
  )
}

function LeadsTab() {
  const { data, isLoading } = useQuery({ queryKey: ['analytics-leads'], queryFn: analyticsService.getLeadsAnalytics })
  if (isLoading) return <Spinner />
  return (
    <Card>
      <CardHeader title="Lead funnel" description={`Average lead score: ${data.avgLeadScore}`} />
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data.funnel} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" stroke="#eef0f4" />
          <XAxis type="number" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis dataKey="stage" type="category" width={100} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
          <Tooltip />
          <Bar dataKey="value" fill="#4a63f7" radius={[0, 6, 6, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  )
}

function AgentsTab() {
  const { data, isLoading } = useQuery({ queryKey: ['analytics-agents'], queryFn: analyticsService.getAgentAnalytics })
  if (isLoading) return <Spinner />
  const columns = [
    { key: 'name', header: 'Agent' },
    { key: 'conversationsHandled', header: 'Conversations handled' },
    { key: 'resolutionRate', header: 'Resolution rate', render: (r) => `${r.resolutionRate}%` },
  ]
  return (
    <Card padded={false}>
      <Table columns={columns} data={data} rowKey="agentId" />
    </Card>
  )
}

function AiTab({ days }) {
  const { data, isLoading } = useQuery({ queryKey: ['analytics-ai', days], queryFn: () => analyticsService.getAiUsageAnalytics({ days }) })
  if (isLoading) return <Spinner />
  const chartData = data.conversations.map((p) => ({ date: p.date.slice(5), value: p.value }))
  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard label="Conversations in period" value={data.conversations.reduce((sum, p) => sum + p.value, 0).toLocaleString()} />
        <StatCard label="Total AI conversations handled" value={data.totalHandled.toLocaleString()} />
      </div>
      <Card className="mt-4">
        <CardHeader title="AI conversations handled" />
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eef0f4" />
            <XAxis dataKey="date" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
            <Tooltip />
            <Area type="monotone" dataKey="value" stroke="#9333ea" fill="#9333ea20" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </Card>
    </>
  )
}

function AutomationTab() {
  const { data, isLoading } = useQuery({ queryKey: ['analytics-automation'], queryFn: analyticsService.getAutomationAnalytics })
  if (isLoading) return <Spinner />
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div className="flex flex-col gap-4">
        <StatCard label="Total automation runs" value={data.totalRuns.toLocaleString()} />
        <StatCard label="Success rate" value={`${data.successRate}%`} />
      </div>
      <Card>
        <CardHeader title="Top workflows by runs" />
        <Table columns={[{ key: 'name', header: 'Workflow' }, { key: 'runs', header: 'Runs' }]} data={data.topWorkflows} rowKey="name" />
      </Card>
    </div>
  )
}

function WhatsappTab({ days }) {
  const { data, isLoading } = useQuery({ queryKey: ['analytics-whatsapp', days], queryFn: () => analyticsService.getWhatsappUsageAnalytics({ days }) })
  if (isLoading) return <Spinner />
  const chartData = data.volume.map((p) => ({ date: p.date.slice(5), value: p.value }))
  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard label="Quality rating" value={data.qualityRating} />
        <StatCard label="Messages this month" value={data.monthlyMessageCount.toLocaleString()} />
      </div>
      <Card className="mt-4">
        <CardHeader title="Message volume" />
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eef0f4" />
            <XAxis dataKey="date" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
            <Tooltip />
            <Bar dataKey="value" fill="#16a34a" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>
    </>
  )
}
