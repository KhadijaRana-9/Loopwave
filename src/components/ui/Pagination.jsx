import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Select } from './Input'

export default function Pagination({ page, pageCount, pageSize, totalItems, onPageChange, onPageSizeChange, pageSizeOptions = [10, 25, 50] }) {
  if (totalItems === 0) return null

  const start = (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, totalItems)

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 px-1 py-3 text-sm text-ink-500">
      <div className="flex items-center gap-2">
        <span>
          {start}–{end} of {totalItems}
        </span>
        {onPageSizeChange && (
          <Select aria-label="Rows per page" value={pageSize} onChange={(e) => onPageSizeChange(Number(e.target.value))} className="h-8 w-auto text-xs">
            {pageSizeOptions.map((size) => (
              <option key={size} value={size}>
                {size} / page
              </option>
            ))}
          </Select>
        )}
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-500 hover:bg-ink-100 disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="px-2 text-xs font-medium text-ink-600">
          Page {page} of {pageCount}
        </span>
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= pageCount}
          aria-label="Next page"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-500 hover:bg-ink-100 disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
