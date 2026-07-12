import { useEffect, useMemo, useState } from 'react'
import { FileText, ExternalLink, ImageIcon } from 'lucide-react'
import { useAppData } from '@/lib/appData'
import { Card, PageHeader, Badge } from '@/components/forms'
import { money, formatPeriod } from '@/lib/format'
import type { Expense } from '@/types'
import { GROUP_LABELS } from '@/types'
import { listExpenses } from '@/lib/repos/expenses'

function isImage(name?: string) {
  return !!name && /\.(png|jpe?g|gif|webp|heic)$/i.test(name)
}

export default function Receipts() {
  const { building } = useAppData()
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [period, setPeriod] = useState('')

  useEffect(() => {
    if (!building) return
    listExpenses(building.id).then(setExpenses)
  }, [building])

  const withReceipts = expenses.filter((e) => e.receiptUrl)
  const periods = useMemo(
    () => Array.from(new Set(withReceipts.map((e) => e.period))).sort().reverse(),
    [withReceipts],
  )
  const filtered = period ? withReceipts.filter((e) => e.period === period) : withReceipts

  return (
    <div>
      <PageHeader
        title="Παραστατικά"
        subtitle="Πίνακας ανάρτησης αποδείξεων εξόδων"
        actions={
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">Όλες οι περίοδοι</option>
            {periods.map((p) => (
              <option key={p} value={p}>
                {formatPeriod(p)}
              </option>
            ))}
          </select>
        }
      />

      {filtered.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center gap-2 py-10 text-center text-gray-400">
            <FileText size={28} />
            <p className="text-sm">
              Δεν υπάρχουν αναρτημένα παραστατικά. Ανεβάστε αρχεία στις δαπάνες.
            </p>
          </div>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((e) => (
            <a
              key={e.id}
              href={e.receiptUrl}
              target="_blank"
              rel="noreferrer"
              className="group overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm transition hover:border-blue-300 hover:shadow"
            >
              <div className="flex h-36 items-center justify-center overflow-hidden bg-gray-50">
                {isImage(e.receiptName) ? (
                  <img
                    src={e.receiptUrl}
                    alt={e.receiptName}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <FileText className="text-gray-300" size={40} />
                )}
              </div>
              <div className="p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium text-gray-900">{e.category}</span>
                  <ExternalLink size={14} className="shrink-0 text-gray-300 group-hover:text-blue-600" />
                </div>
                <div className="mt-1 flex items-center justify-between text-xs text-gray-500">
                  <Badge color="blue">{GROUP_LABELS[e.group]}</Badge>
                  <span className="tnum">{money(e.amount)}</span>
                </div>
                <div className="mt-1 flex items-center gap-1 text-xs text-gray-400">
                  {isImage(e.receiptName) ? <ImageIcon size={12} /> : <FileText size={12} />}
                  {formatPeriod(e.period)}
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
