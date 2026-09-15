import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Send, Sparkles } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import Badge from '@/components/ui/Badge'
import { generateId } from '@/services/http'
import * as aiAgentsService from '@/services/aiAgentsService'

// Talks to the real backend test endpoint (server/src/services/aiAgents.service.ts
// -> integrations/ai.adapter.ts), which calls a real LLM when OPENAI_API_KEY is
// configured or otherwise runs a clearly-labeled demo simulation grounded in
// this agent's own FAQs/questions — never a fake response presented as live AI.
export default function TestConversationModal({ open, onClose, agent }) {
  const [messages, setMessages] = useState(() => initialMessages(agent))
  const [input, setInput] = useState('')
  const [done, setDone] = useState(false)

  const sendMutation = useMutation({
    mutationFn: (text) => aiAgentsService.testAgentMessage(agent.id, text, historyFor(messages)),
  })

  function initialMessages(a) {
    return [{ id: generateId('m'), from: 'agent', text: `Hi! I'm ${a.name}. ${a.description}` }]
  }

  function historyFor(msgs) {
    return msgs.map((m) => ({ from: m.from, text: m.text }))
  }

  function reset() {
    setMessages(initialMessages(agent))
    setInput('')
    setDone(false)
  }

  function handleClose() {
    reset()
    onClose()
  }

  function handleSend() {
    const text = input.trim()
    if (!text || done) return
    const userMsg = { id: generateId('m'), from: 'user', text }
    setMessages((m) => [...m, userMsg])
    setInput('')

    sendMutation.mutate(text, {
      onSuccess: (result) => {
        setMessages((m) => [...m, { id: generateId('m'), from: 'agent', text: result.reply }])
        if (/lead score:/i.test(result.reply)) setDone(true)
      },
      onError: () => {
        setMessages((m) => [...m, { id: generateId('m'), from: 'agent', text: "Sorry, I couldn't process that — please try again." }])
      },
    })
  }

  return (
    <Modal open={open} onClose={handleClose} title={`Test: ${agent.name}`} description="Simulated using this agent's own configured questions and FAQs." size="md">
      <div className="flex h-96 flex-col">
        <div className="flex-1 space-y-3 overflow-y-auto rounded-lg bg-ink-50 p-3">
          {messages.map((m) => (
            <div key={m.id} className={`flex ${m.from === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${m.from === 'user' ? 'bg-brand-500 text-white' : 'bg-white text-ink-800 shadow-sm'}`}>
                {m.from === 'agent' && (
                  <div className="mb-1 flex items-center gap-1 text-[10px] font-medium text-purple-600">
                    <Sparkles className="h-3 w-3" /> AI
                  </div>
                )}
                {m.text}
              </div>
            </div>
          ))}
          {done && (
            <div className="flex justify-center">
              <Badge tone="success">Conversation complete</Badge>
            </div>
          )}
        </div>
        <div className="mt-3 flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            disabled={done || sendMutation.isPending}
            placeholder={done ? 'Conversation complete — reopen to try again' : 'Type a message as the customer...'}
            className="h-10 flex-1 rounded-lg border border-ink-200 px-3 text-sm outline-none focus:border-brand-500 disabled:bg-ink-100"
          />
          <button
            onClick={handleSend}
            disabled={done || sendMutation.isPending}
            className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-500 text-white disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </Modal>
  )
}
