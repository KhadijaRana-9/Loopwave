import { apiClient } from './apiClient'

// Talks to the real backend (server/src/routes/contacts.routes.ts). Returns
// the flat array pages already expect — react-query callers don't change.
// pageSize is capped at 100 server-side (a real, intentional limit — see
// listContactsQuerySchema) to stop an unbounded query from being abused;
// callers here (and GlobalSearch, which fetches the same list) only ever
// see the first 100 contacts. Real server-side pagination for tenants with
// more than that is a follow-up, not something to paper over by asking for
// more than the API will ever allow.
export async function listContacts({ search = '', status = 'all', tag = 'all' } = {}) {
  const params = new URLSearchParams({ pageSize: '100' })
  if (search) params.set('search', search)
  if (status !== 'all') params.set('leadStatus', status.toUpperCase())
  if (tag !== 'all') params.set('tag', tag)
  const { items } = await apiClient.get(`/contacts?${params.toString()}`)
  return items
}

export async function getContact(id) {
  const { contact } = await apiClient.get(`/contacts/${id}`)
  return contact
}

export async function createContact(data) {
  const { contact } = await apiClient.post('/contacts', data)
  return contact
}

export async function updateContact(id, patch) {
  const { contact } = await apiClient.patch(`/contacts/${id}`, patch)
  return contact
}

export async function deleteContacts(ids) {
  const { affected } = await apiClient.post('/contacts/bulk', { contactIds: ids, action: 'delete' })
  return { deleted: affected }
}
