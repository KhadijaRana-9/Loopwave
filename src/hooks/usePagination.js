import { useState } from 'react'

export function usePagination(items, defaultPageSize = 10) {
  const [rawPage, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(defaultPageSize)

  const pageCount = Math.max(1, Math.ceil(items.length / pageSize))
  // Derived during render (not via effect+setState) so a shrinking filtered
  // list never shows a stale/empty page while waiting for a re-render.
  const page = Math.min(rawPage, pageCount)
  const pageItems = items.slice((page - 1) * pageSize, page * pageSize)

  return {
    page,
    pageCount,
    pageSize,
    totalItems: items.length,
    pageItems,
    setPage,
    setPageSize: (size) => {
      setPageSize(size)
      setPage(1)
    },
  }
}
