import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PiggyBank, FileSpreadsheet, Receipt, Wallet, Paperclip, ChevronRight } from 'lucide-react'
import { useAppData } from '@/lib/appData'
import { Card, PageHeader, Badge } from '@/components/forms'
import { money, formatPeriod, formatDate } from '@/lib/format'
import { GROUP_LABELS, PAYMENT_METHOD_LABELS } from '@/types'
import type { Expense, Payment, Statement, FundEntry } from '@/types'
import { listStatements } from '@/lib/repos/statements'
import { listExpenses } from '@/lib/repos/expenses'
import { listPayments } from '@/lib/repos/payments'
import { listFundEntries, fundBalance } from '@/lib/repos/fund'

export default function Finances() {
  const { building, apartments } = useAppData()
  const [statements, setStatements] = useState<Statement[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [fund, setFund] = useState<FundEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [expPeriod, setExpPeriod] = useState<string>('')

  useEffect(() => {
    if (!building) return
    void (async () => {
      setLoading(true)
      try {
        const [st, ex, pay, fe] = await Promise.all([
          listStatements(building.id),
          listExpenses(building.id),
          listPayments(building.id),
          listFundEntries(building.id),
        ])
        setStatements(st.filter((s) => s.status === 'issued'))
        setExpenses(ex)
        setPayments(pay)
        setFund(fe)
      } finally {
        setLoading(false)
      }
    })()
  }, [building])

  const aptCode = (id: string) => apartments.find((a) => a.id === id)?.code ?? '—'

  const balance = fundBalance(fund)
  const totalIn = fund.filter((e) => e.type === 'in').reduce((s, e) => s + e.amount, 0)
  const totalOut = fund.filter((e) => e.type === 'out').reduce((s, e) => s + e.amount, 0)

  // Διαθέσιμες περίοδοι δαπανών (φθίνουσα) — για το φίλτρο.
  const expPeriods = useMemo(
    () => Array.from(new Set(expenses.map((e) => e.period))).sort((a, b) => (a < b ? 1 : -1)),
    [expenses],
  )
  const selectedExpPeriod = expPeriod || expPeriods[0] || ''
  const periodExpenses = useMemo(
    () => expenses.filter((e) => e.period === selectedExpPeriod),
    [expenses, selectedExpPeriod],
  )
  const periodExpTotal = periodExpenses.reduce((s, e) => s + e.amount, 0)

  const recentPayments = useMemo(
    () =>
      [...payments].sort((a, b) => (b.date?.toMillis?.() ?? 0) - (a.date?.toMillis?.() ?? 0)).slice(0, 50),
    [payments],
  )

  if (loading) return <div className="text-gray-400">Φόρτωση…</div>

  return (
    <div className="space-y-6">
      <PageHeader title="Οικονομικά κτιρίου" subtitle={building?.name} />

      {/* Ταμείο / Αποθεματικό */}
      <Card>
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
          <PiggyBank size={18} /> Ταμείο / Αποθεματικό
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg bg-blue-600 p-3 text-white">
            <div className="text-xs opacity-80">Υπόλοιπο ταμείου</div>
            <div className="tnum text-2xl font-bold">{money(balance)}</div>
          </div>
          <div className="rounded-lg border border-gray-200 p-3">
            <div className="text-xs text-gray-500">Σύνολο εισπράξεων</div>
            <div className="tnum text-lg font-semibold text-green-700">{money(totalIn)}</div>
          </div>
          <div className="rounded-lg border border-gray-200 p-3">
            <div className="text-xs text-gray-500">Σύνολο πληρωμών</div>
            <div className="tnum text-lg font-semibold text-red-600">{money(totalOut)}</div>
          </div>
        </div>
      </Card>

      {/* Συγκεντρωτικές καταστάσεις ανά περίοδο */}
      <Card className="p-0">
        <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3 text-sm font-semibold text-gray-700">
          <FileSpreadsheet size={18} /> Συγκεντρωτικές κοινοχρήστων ανά περίοδο
        </div>
        {statements.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-gray-400">Καμία έκδοση ακόμη.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {statements.map((s) => (
              <li key={s.id}>
                <Link to={`/statements/${s.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50">
                  <Receipt size={16} className="text-gray-400" />
                  <span className="flex-1 text-sm text-gray-800">{s.periodLabel || formatPeriod(s.period)}</span>
                  <span className="tnum text-sm font-medium text-gray-900">{money(s.totals.grandTotal)}</span>
                  <ChevronRight size={16} className="text-gray-300" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Δαπάνες ανά περίοδο με έγγραφα */}
      <Card className="p-0">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-4 py-3">
          <span className="flex items-center gap-2 text-sm font-semibold text-gray-700">
            <Receipt size={18} /> Δαπάνες ανά περίοδο
          </span>
          {expPeriods.length > 0 && (
            <select
              value={selectedExpPeriod}
              onChange={(e) => setExpPeriod(e.target.value)}
              className="rounded-md border border-gray-300 px-2 py-1 text-sm shadow-sm focus:border-blue-500 focus:outline-none"
            >
              {expPeriods.map((p) => (
                <option key={p} value={p}>
                  {formatPeriod(p)}
                </option>
              ))}
            </select>
          )}
        </div>
        {periodExpenses.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-gray-400">Καμία δαπάνη για την περίοδο.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs uppercase text-gray-500">
                <th className="px-4 py-2">Κατηγορία</th>
                <th className="px-4 py-2">Ομάδα</th>
                <th className="px-4 py-2">Έγγραφο</th>
                <th className="px-4 py-2 text-right">Ποσό</th>
              </tr>
            </thead>
            <tbody>
              {periodExpenses.map((e) => (
                <tr key={e.id} className="border-t border-gray-50">
                  <td className="px-4 py-2 text-gray-800">{e.category}</td>
                  <td className="px-4 py-2">
                    <Badge color="blue">{GROUP_LABELS[e.group]}</Badge>
                  </td>
                  <td className="px-4 py-2">
                    {e.receiptUrl ? (
                      <a
                        href={e.receiptUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                      >
                        <Paperclip size={14} /> {e.receiptName || 'Παραστατικό'}
                      </a>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right tnum">{money(e.amount)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-200 bg-gray-50 font-semibold">
                <td className="px-4 py-2" colSpan={3}>
                  ΣΥΝΟΛΟ ({periodExpenses.length})
                </td>
                <td className="px-4 py-2 text-right tnum">{money(periodExpTotal)}</td>
              </tr>
            </tfoot>
          </table>
        )}
      </Card>

      {/* Πληρωμές */}
      <Card className="p-0">
        <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3 text-sm font-semibold text-gray-700">
          <Wallet size={18} /> Πληρωμές
        </div>
        {recentPayments.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-gray-400">Καμία πληρωμή ακόμη.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs uppercase text-gray-500">
                <th className="px-4 py-2">Ημ/νία</th>
                <th className="px-4 py-2">Διαμ.</th>
                <th className="px-4 py-2">Τρόπος</th>
                <th className="px-4 py-2 text-right">Ποσό</th>
              </tr>
            </thead>
            <tbody>
              {recentPayments.map((p) => (
                <tr key={p.id} className="border-t border-gray-50">
                  <td className="px-4 py-2 text-gray-500">{formatDate(p.date)}</td>
                  <td className="px-4 py-2 font-medium text-gray-800">{aptCode(p.apartmentId)}</td>
                  <td className="px-4 py-2 text-gray-600">{PAYMENT_METHOD_LABELS[p.method]}</td>
                  <td className="px-4 py-2 text-right tnum text-green-700">{money(p.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}
