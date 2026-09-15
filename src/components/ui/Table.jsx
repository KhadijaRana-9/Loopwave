import clsx from 'clsx'
import { Inbox } from 'lucide-react'

export default function Table({
  columns,
  data,
  rowKey = 'id',
  onRowClick,
  selectable,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  emptyTitle = 'Nothing here yet',
  emptyDescription = 'Try adjusting your search or filters.',
}) {
  const allSelected = selectable && data.length > 0 && data.every((row) => selectedIds?.includes(row[rowKey]))
  const colSpan = columns.length + (selectable ? 1 : 0)

  return (
    <div className="overflow-x-auto rounded-xl border border-ink-200">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="border-b border-ink-200 bg-ink-50 text-xs font-medium uppercase tracking-wide text-ink-500">
            {selectable && (
              <th className="w-10 px-4 py-3">
                <input type="checkbox" checked={allSelected} onChange={onToggleSelectAll} className="rounded border-ink-300" aria-label="Select all rows" />
              </th>
            )}
            {columns.map((col) => (
              <th key={col.key} className="px-4 py-3">
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={colSpan} className="px-4 py-14 text-center">
                <div className="flex flex-col items-center gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-ink-100">
                    <Inbox className="h-5 w-5 text-ink-400" />
                  </div>
                  <p className="text-sm font-medium text-ink-700">{emptyTitle}</p>
                  <p className="text-xs text-ink-400">{emptyDescription}</p>
                </div>
              </td>
            </tr>
          ) : (
            data.map((row) => (
              <tr
                key={row[rowKey]}
                onClick={() => onRowClick?.(row)}
                className={clsx(
                  'border-b border-ink-100 last:border-0',
                  onRowClick && 'cursor-pointer hover:bg-ink-50',
                )}
              >
                {selectable && (
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedIds?.includes(row[rowKey]) ?? false}
                      onChange={() => onToggleSelect(row[rowKey])}
                      className="rounded border-ink-300"
                      aria-label={`Select ${row.name ?? row.title ?? row[rowKey]}`}
                    />
                  </td>
                )}
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-3 text-ink-700">
                    {col.render ? col.render(row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
