// Meta Cloud API's real, documented limits per media type — enforced here
// before we ever call Meta, so a rejection is instant and doesn't burn an
// upload attempt. https://developers.facebook.com/docs/whatsapp/cloud-api/reference/media
export const MEDIA_LIMITS = {
  image: { maxBytes: 5 * 1024 * 1024, mimeTypes: ['image/jpeg', 'image/png'] },
  video: { maxBytes: 16 * 1024 * 1024, mimeTypes: ['video/mp4', 'video/3gpp'] },
  document: {
    maxBytes: 100 * 1024 * 1024,
    mimeTypes: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
    ],
  },
} as const

export type MediaKind = keyof typeof MEDIA_LIMITS

export function mediaKindForMimeType(mimeType: string): MediaKind | null {
  for (const kind of Object.keys(MEDIA_LIMITS) as MediaKind[]) {
    if ((MEDIA_LIMITS[kind].mimeTypes as readonly string[]).includes(mimeType)) return kind
  }
  return null
}

export function assertMediaAllowed(mimeType: string, sizeBytes: number): { kind: MediaKind } {
  const kind = mediaKindForMimeType(mimeType)
  if (!kind) throw new Error(`Unsupported file type for WhatsApp: ${mimeType}`)
  if (sizeBytes > MEDIA_LIMITS[kind].maxBytes) {
    const maxMb = (MEDIA_LIMITS[kind].maxBytes / (1024 * 1024)).toFixed(0)
    throw new Error(`${kind} files must be ${maxMb}MB or smaller for WhatsApp`)
  }
  return { kind }
}
