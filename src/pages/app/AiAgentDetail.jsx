import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Plus, Sparkles, Trash2 } from 'lucide-react'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Card from '@/components/ui/Card'
import Tabs from '@/components/ui/Tabs'
import Spinner from '@/components/ui/Spinner'
import { Input, Textarea } from '@/components/ui/Input'
import TestConversationModal from '@/features/ai-agents/TestConversationModal'
import { toast } from '@/store/toastStore'
import * as aiAgentsService from '@/services/aiAgentsService'

const TABS = [
  { value: 'general', label: 'General' },
  { value: 'knowledge', label: 'Knowledge & FAQs' },
  { value: 'qualification', label: 'Lead qualification' },
  { value: 'handoff', label: 'Human handoff' },
]

export default function AiAgentDetail() {
  const { id } = useParams()
  const { data: agent, isLoading } = useQuery({ queryKey: ['ai-agent', id], queryFn: () => aiAgentsService.getAiAgent(id) })

  if (isLoading || !agent) return <Spinner label="Loading agent..." />

  // Keyed by agent.id so switching to a different agent remounts this with
  // fresh local edit state instead of carrying over the previous agent's form.
  return <AgentEditor key={agent.id} id={id} agent={agent} />
}

function AgentEditor({ id, agent }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState('general')
  const [form, setForm] = useState(agent)
  const [testOpen, setTestOpen] = useState(false)

  const saveMutation = useMutation({
    mutationFn: () => aiAgentsService.updateAiAgent(id, form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-agent', id] })
      queryClient.invalidateQueries({ queryKey: ['ai-agents'] })
      toast.success('Agent configuration saved')
    },
  })

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  function updateListItem(field, index, value) {
    setForm((f) => ({ ...f, [field]: f[field].map((v, i) => (i === index ? value : v)) }))
  }

  function addListItem(field, empty) {
    setForm((f) => ({ ...f, [field]: [...f[field], empty] }))
  }

  function removeListItem(field, index) {
    setForm((f) => ({ ...f, [field]: f[field].filter((_, i) => i !== index) }))
  }

  return (
    <div>
      <button onClick={() => navigate('/app/ai-agents')} className="mb-3 inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-800">
        <ArrowLeft className="h-4 w-4" /> AI Agents
      </button>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold text-ink-900">{form.name}</h1>
          <Badge tone={form.status === 'active' ? 'success' : 'neutral'}>{form.status}</Badge>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setTestOpen(true)}>
            <Sparkles className="h-4 w-4" /> Test conversation
          </Button>
          <Button variant="outline" onClick={() => update('status', form.status === 'active' ? 'draft' : 'active')}>
            {form.status === 'active' ? 'Deactivate' : 'Activate'}
          </Button>
          <Button loading={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
            Save changes
          </Button>
        </div>
      </div>

      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {tab === 'general' && (
            <Card className="flex flex-col gap-4">
              <Input label="Agent name" value={form.name} onChange={(e) => update('name', e.target.value)} />
              <Textarea label="Description" value={form.description} onChange={(e) => update('description', e.target.value)} rows={2} />
              <Textarea
                label="Personality & instructions"
                value={form.personality}
                onChange={(e) => update('personality', e.target.value)}
                rows={3}
                hint="How the agent should sound — tone, style, boundaries."
              />
              <div>
                <label className="mb-1.5 block text-sm font-medium text-ink-700">Conversation goals</label>
                <div className="flex flex-col gap-2">
                  {form.goals.map((goal, i) => (
                    <div key={i} className="flex gap-2">
                      <Input value={goal} onChange={(e) => updateListItem('goals', i, e.target.value)} className="flex-1" />
                      <button onClick={() => removeListItem('goals', i)} className="rounded-lg p-2 text-ink-400 hover:bg-danger-100 hover:text-danger-500" aria-label={`Remove goal ${i + 1}`}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={() => addListItem('goals', '')} className="w-fit">
                    <Plus className="h-4 w-4" /> Add goal
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {tab === 'knowledge' && (
            <Card className="flex flex-col gap-4">
              <Textarea
                label="Business information"
                value={form.businessInfo}
                onChange={(e) => update('businessInfo', e.target.value)}
                rows={3}
                hint="Context the agent uses to answer questions about your business."
              />
              <div>
                <label className="mb-1.5 block text-sm font-medium text-ink-700">FAQs</label>
                <div className="flex flex-col gap-3">
                  {form.faqs.map((faq, i) => (
                    <div key={i} className="rounded-lg border border-ink-200 p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-xs font-medium text-ink-500">FAQ {i + 1}</span>
                        <button onClick={() => removeListItem('faqs', i)} className="text-ink-400 hover:text-danger-500" aria-label={`Remove FAQ ${i + 1}`}>
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <Input
                        value={faq.question}
                        onChange={(e) => updateListItem('faqs', i, { ...faq, question: e.target.value })}
                        placeholder="Question"
                        className="mb-2"
                      />
                      <Textarea
                        value={faq.answer}
                        onChange={(e) => updateListItem('faqs', i, { ...faq, answer: e.target.value })}
                        placeholder="Answer"
                        rows={2}
                      />
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={() => addListItem('faqs', { question: '', answer: '' })} className="w-fit">
                    <Plus className="h-4 w-4" /> Add FAQ
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {tab === 'qualification' && (
            <Card className="flex flex-col gap-4">
              <label className="block text-sm font-medium text-ink-700">Lead qualification questions</label>
              <div className="flex flex-col gap-2">
                {form.qualificationQuestions.map((q, i) => (
                  <div key={i} className="flex gap-2">
                    <Input value={q} onChange={(e) => updateListItem('qualificationQuestions', i, e.target.value)} className="flex-1" />
                    <button onClick={() => removeListItem('qualificationQuestions', i)} className="rounded-lg p-2 text-ink-400 hover:bg-danger-100 hover:text-danger-500" aria-label={`Remove question ${i + 1}`}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={() => addListItem('qualificationQuestions', '')} className="w-fit">
                  <Plus className="h-4 w-4" /> Add question
                </Button>
              </div>
            </Card>
          )}

          {tab === 'handoff' && (
            <Card className="flex flex-col gap-4">
              <Textarea
                label="Handoff rules"
                value={form.handoffRules}
                onChange={(e) => update('handoffRules', e.target.value)}
                rows={4}
                hint="When should this agent escalate to a human teammate?"
              />
            </Card>
          )}
        </div>

        <Card>
          <h3 className="mb-3 text-sm font-semibold text-ink-900">Sample conversation output</h3>
          <p className="mb-2 text-xs text-ink-500">Demo — illustrates what the team sees after the AI qualifies a lead.</p>
          <div className="space-y-3 rounded-lg bg-ink-50 p-3 text-xs">
            <div>
              <span className="font-medium text-ink-700">Customer:</span>
              <p className="text-ink-600">"I need software for my textile business."</p>
            </div>
            <div>
              <span className="font-medium text-ink-700">Lead score:</span> <Badge tone="success">78 / 100</Badge>
            </div>
            <div>
              <span className="font-medium text-ink-700">Summary:</span>
              <p className="text-ink-600">Mid-size textile manufacturer, 25 employees, evaluating WhatsApp CRM tools this quarter.</p>
            </div>
            <div>
              <span className="font-medium text-ink-700">Recommended action:</span>
              <p className="text-ink-600">Assign to sales agent for a Pro plan demo.</p>
            </div>
          </div>
        </Card>
      </div>

      <TestConversationModal open={testOpen} onClose={() => setTestOpen(false)} agent={form} />
    </div>
  )
}
