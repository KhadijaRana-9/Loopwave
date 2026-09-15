import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plug, Settings2, Zap } from 'lucide-react'
import PageHeader from '@/components/ui/PageHeader'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import Spinner from '@/components/ui/Spinner'
import { toast } from '@/store/toastStore'
import * as integrationsService from '@/services/integrationsService'

export default function IntegrationsApp() {
  const [configuring, setConfiguring] = useState(null)
  const [configForm, setConfigForm] = useState({})
  const queryClient = useQueryClient()
  const integrationsQuery = useQuery({ queryKey: ['integrations'], queryFn: integrationsService.listIntegrations })

  const toggleMutation = useMutation({
    mutationFn: integrationsService.toggleIntegration,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['integrations'] })
      toast.success(`${result.name} ${result.connected ? 'connected' : 'disconnected'}`)
    },
  })

  const saveConfigMutation = useMutation({
    mutationFn: ({ id, config }) => integrationsService.saveIntegrationConfig(id, config),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['integrations'] })
      setConfiguring(null)
      toast.success(`${result.name} configuration saved`)
    },
  })

  const testMutation = useMutation({
    mutationFn: (id) => integrationsService.testIntegrationConnection(id),
    onSuccess: (result) => {
      if (result.ok) toast.success('Connection test succeeded')
      else toast.error(`Connection test failed: ${result.reason}`)
    },
  })

  if (integrationsQuery.isLoading) return <Spinner label="Loading integrations..." />
  const integrations = integrationsQuery.data

  function openConfigure(integration) {
    setConfiguring(integration)
    setConfigForm(integration.config ?? {})
  }

  return (
    <div>
      <PageHeader title="Integrations" description="Connect Loopwave to the tools your business already runs on" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {integrations.map((integration) => (
          <Card key={integration.id}>
            <div className="flex items-center justify-between">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-ink-100 text-ink-500">
                <Plug className="h-4.5 w-4.5" />
              </div>
              <Badge tone={integration.connected ? 'success' : 'neutral'}>{integration.connected ? 'Connected' : 'Not connected'}</Badge>
            </div>
            <h3 className="mt-3 text-sm font-semibold text-ink-900">{integration.name}</h3>
            <span className="text-xs text-ink-400">{integration.category}</span>
            <p className="mt-2 text-sm text-ink-500">{integration.description}</p>
            <div className="mt-3 flex gap-2">
              <Button variant="outline" size="sm" className="flex-1 justify-center" onClick={() => openConfigure(integration)}>
                <Settings2 className="h-3.5 w-3.5" /> Configure
              </Button>
              {integration.connected ? (
                <Button variant="outline" size="sm" onClick={() => toggleMutation.mutate(integration.id)}>
                  Disconnect
                </Button>
              ) : (
                <Button size="sm" onClick={() => toggleMutation.mutate(integration.id)}>
                  Connect
                </Button>
              )}
            </div>
          </Card>
        ))}
      </div>

      <Modal
        open={!!configuring}
        onClose={() => setConfiguring(null)}
        title={`Configure ${configuring?.name}`}
        description="Demo build — credentials are held in memory only and no real API call is made until a backend is connected."
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => testMutation.mutate(configuring.id)}
              loading={testMutation.isPending}
            >
              <Zap className="h-4 w-4" /> Test connection
            </Button>
            <Button
              loading={saveConfigMutation.isPending}
              onClick={() => saveConfigMutation.mutate({ id: configuring.id, config: configForm })}
            >
              Save configuration
            </Button>
          </>
        }
      >
        {configuring && (
          <div className="flex flex-col gap-4">
            {configuring.configFields.map((field) => (
              <Input
                key={field.key}
                label={field.label}
                value={configForm[field.key] ?? ''}
                onChange={(e) => setConfigForm({ ...configForm, [field.key]: e.target.value })}
                placeholder={`Enter ${field.label.toLowerCase()}`}
              />
            ))}
          </div>
        )}
      </Modal>
    </div>
  )
}
