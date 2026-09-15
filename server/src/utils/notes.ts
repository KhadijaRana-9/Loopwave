import { prisma } from '@/config/prisma.js'

// ContactNote/DealNote/ConversationNote store a bare authorId string (no FK
// relation to User, since the author may be deleted later without cascading
// note history) — this resolves display names for a batch of notes in one
// query instead of Prisma `include`, which isn't available for a relation-less field.
export async function attachAuthorNames<T extends { authorId: string | null }>(
  notes: T[],
): Promise<(T & { author: string })[]> {
  const ids = [...new Set(notes.map((n) => n.authorId).filter((id): id is string => Boolean(id)))]
  const users = ids.length ? await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }) : []
  const nameById = new Map(users.map((u) => [u.id, u.name]))
  return notes.map((n) => ({ ...n, author: n.authorId ? (nameById.get(n.authorId) ?? 'Former teammate') : 'System' }))
}

export async function resolveAuthorName(authorId: string | undefined): Promise<string> {
  if (!authorId) return 'System'
  const user = await prisma.user.findUnique({ where: { id: authorId }, select: { name: true } })
  return user?.name ?? 'Former teammate'
}
