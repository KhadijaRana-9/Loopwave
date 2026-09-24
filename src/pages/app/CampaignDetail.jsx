import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import PageHeader from '@/components/ui/PageHeader'
import Card, { CardHeader } from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Spinner from '@/components/ui/Spinner'
import StatCard from '@/components/ui/StatCard'
import * as campaignsService from '@/services/campaignsService'

export default function CampaignDetail() {
  const { id } = useParams()
  const { data: campaign, isLoading } = useQuery({
    queryKey: ['campaign', id],
    queryFn: () => campaignsService.getCampaign(id),
  })

  if (isLoading) return <Spinner label="Loading campaign..." />
  if (!campaign) return <p className="text-sm text-ink-500">Campaign not found.</p>

  const funnel = [
    { stage: 'Sent', value: campaign.sent },
    { stage: 'Delivered', value: campaign.delivered },
    { stage: 'Read', value: campaign.read },
    { stage: 'Replied', value: campaign.replied },
    { stage: 'Clicked', value: campaign.clicked },
    { stage: 'Converted', value: campaign.converted },
  ]

  return (
    <div>
      <Link to="/app/campaigns" className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-800">
        <ArrowLeft className="h-4 w-4" /> Back to campaigns
      </Link>
      <PageHeader
        title={campaign.name}
        description={`Template: ${campaign.template?.name ?? '—'}`}
        action={
          <div className="flex items-center gap-2">
            {campaign.demoSent > 0 && (
              <Badge tone="warning" title="No WhatsApp number was connected when this campaign sent — these deliveries are simulated, not Meta-confirmed.">
                {campaign.demoSent === campaign.sent ? 'Simulated (no number connected)' : `${campaign.demoSent} simulated`}
              </Badge>
            )}
            <Badge tone="brand">{campaign.status}</Badge>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Sent" value={campaign.sent.toLocaleString()} />
        <StatCard label="Delivered" value={campaign.delivered.toLocaleString()} />
        <StatCard label="Failed" value={campaign.failed.toLocaleString()} />
        <StatCard label="Read" value={campaign.read.toLocaleString()} />
        <StatCard label="Replied" value={campaign.replied.toLocaleString()} />
        <StatCard label="Converted" value={campaign.converted.toLocaleString()} />
      </div>

      <Card className="mt-6">
        <CardHeader title="Performance funnel" />
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={funnel}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eef0f4" />
            <XAxis dataKey="stage" tick={{ fontSize: 12, fill: '#737d92' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 12, fill: '#737d92' }} axisLine={false} tickLine={false} />
            <Tooltip />
            <Bar dataKey="value" fill="#4a63f7" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>
    </div>
  )
}
