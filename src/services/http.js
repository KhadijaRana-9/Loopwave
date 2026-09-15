// Client-side-only ephemeral ids for things that never touch the backend
// (chat bubbles in TestConversationModal, unsaved flow-builder canvas nodes
// before a save). Every service now calls the real backend via apiClient.js.
export function generateId(prefix = 'id') {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`
}
