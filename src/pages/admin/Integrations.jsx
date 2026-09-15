import { useQuery } from '@tanstack/react-query'
import PageHeader from '@/components/ui/PageHeader'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Spinner from '@/components/ui/Spinner'
import { Plug } from 'lucide-react'
import * as integrationsService from '@/services/integrationsService'

export default function AdminIntegrations() {
  const integrationsQuery = useQuery({ queryKey: ['integrations'], queryFn: integrationsService.listIntegrations })
  if (integrationsQuery.isLoading) return <Spinner label="Loading integrations..." />

  return (
    <div>
      <PageHeader title="Platform integrations" description="Integrations available to every tenant on the platform" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {integrationsQuery.data.map((integration) => (
          <Card key={integration.id}>
            <div className="flex items-center justify-between">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-ink-100 text-ink-500">
                <Plug className="h-4.5 w-4.5" />
              </div>
              <Badge tone="neutral">{integration.category}</Badge>
            </div>
            <h3 className="mt-3 text-sm font-semibold text-ink-900">{integration.name}</h3>
            <p className="mt-1 text-sm text-ink-500">{integration.description}</p>
          </Card>
        ))}
      </div>
    </div>
  )
}
