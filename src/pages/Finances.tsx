import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PiggyBank, FileSpreadsheet, Receipt, Wallet, Paperclip, ChevronRight, Download } from 'lucide-react'
import { useAppData } from '@/lib/appData'
import { Card, PageHeader, Badge } from '@/components/forms'
import { Modal } from '@/components/Modal'
import { money, formatPeriod, formatDate, currentPeriod } from '@/lib/format'
import { GROUP_LABELS, PAYMENT_METHOD_LABELS, ALLOCATION_LABELS } from '@/types'
import type { Expense, Payment, Statement, FundEntry } from '@/types'
import { listStatements } from '@/lib/repos/statements'
import { listExpenses } from '@/lib/repos/expenses'
import { listPayments } from '@/lib/repos/payments'
import { listFundEntries, fundBalance } from '@/lib/repos/fund'

type ExpView = 'month' | 'quarter' | 'year' | 'range'

function quarterMonths(year: string, q: number): string[] {
  const start = (q - 1) * 3 + 1
  return [0, 1, 2].map((i) => `${year}-${String(start + i).padStart(2, '0')}`)
}

export default function Finances() {
  const { building, apartments } = useAppData()
  const [statements, setStatements] = useState<Statement[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [fund, setFund] = useState<FundEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null)

  // Φίλτρο περιόδου δαπανών
  const [expView, setExpView] = useState<ExpView>('month')
  const [expMonth, setExpMonth] = useState(currentPeriod())
  const [expYear, setExpYear] = useState(currentPeriod().slice(0, 4))
  const [expQuarter, setExpQuarter] = useState(Math.floor(new Date().getMonth() / 3) + 1)
  const [expFrom, setExpFrom] = useState(currentPeriod())
  const [expTo, setExpTo] = useState(currentPeriod())

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

  const periodExpenses = useMemo(() => {
    return expenses.filter((e) => {
      if (expView === 'month') return e.period === expMonth
      if (expView === 'year') return e.period.startsWith(`${expYear}-`)
      if (expView === 'quarter') return quarterMonths(expYear, expQuarter).includes(e.period)
      const f = expFrom <= expTo ? expFrom : expTo
      const t = expFrom <= expTo ? expTo : expFrom
      return e.period >= f && e.period <= t
    })
  }, [expenses, expView, expMonth, expYear, expQuarter, expFrom, expTo])
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
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={expView}
              onChange={(e) => setExpView(e.target.value as ExpView)}
              className="rounded-md border border-gray-300 px-2 py-1 text-sm shadow-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="month">Μήνας</option>
              <option value="quarter">Τρίμηνο</option>
              <option value="year">Έτος</option>
              <option value="range">Εύρος</option>
            </select>
            {expView === 'month' && (
              <input
                type="month"
                value={expMonth}
                onChange={(e) => setExpMonth(e.target.value)}
                className="rounded-md border border-gray-300 px-2 py-1 text-sm shadow-sm focus:border-blue-500 focus:outline-none"
              />
            )}
            {expView === 'quarter' && (
              <>
                <select
                  value={expQuarter}
                  onChange={(e) => setExpQuarter(Number(e.target.value))}
                  className="rounded-md border border-gray-300 px-2 py-1 text-sm shadow-sm focus:border-blue-500 focus:outline-none"
                >
                  {[1, 2, 3, 4].map((q) => (
                    <option key={q} value={q}>
                      {q}ο τρίμηνο
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  value={expYear}
                  onChange={(e) => setExpYear(e.target.value)}
                  className="w-20 rounded-md border border-gray-300 px-2 py-1 text-sm shadow-sm focus:border-blue-500 focus:outline-none"
                />
              </>
            )}
            {expView === 'year' && (
              <input
                type="number"
                value={expYear}
                onChange={(e) => setExpYear(e.target.value)}
                className="w-24 rounded-md border border-gray-300 px-2 py-1 text-sm shadow-sm focus:border-blue-500 focus:outline-none"
              />
            )}
            {expView === 'range' && (
              <div className="flex items-center gap-1">
                <input
                  type="month"
                  value={expFrom}
                  onChange={(e) => setExpFrom(e.target.value)}
                  className="rounded-md border border-gray-300 px-2 py-1 text-sm shadow-sm focus:border-blue-500 focus:outline-none"
                />
                <span className="text-gray-400">–</span>
                <input
                  type="month"
                  value={expTo}
                  onChange={(e) => setExpTo(e.target.value)}
                  className="rounded-md border border-gray-300 px-2 py-1 text-sm shadow-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
            )}
          </div>
        </div>
        {periodExpenses.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-gray-400">Καμία δαπάνη για την περίοδο.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs uppercase text-gray-500">
                <th className="px-4 py-2">Μήνας</th>
                <th className="px-4 py-2">Κατηγορία</th>
                <th className="px-4 py-2">Ομάδα</th>
                <th className="px-4 py-2">Έγγραφο</th>
                <th className="px-4 py-2 text-right">Ποσό</th>
              </tr>
            </thead>
            <tbody>
              {periodExpenses.map((e) => (
                <tr
                  key={e.id}
                  onClick={() => setSelectedExpense(e)}
                  className="cursor-pointer border-t border-gray-50 hover:bg-blue-50/40"
                >
                  <td className="whitespace-nowrap px-4 py-2 text-gray-500">{formatPeriod(e.period)}</td>
                  <td className="px-4 py-2 font-medium text-gray-800">{e.category}</td>
                  <td className="px-4 py-2">
                    <Badge color="blue">{GROUP_LABELS[e.group]}</Badge>
                  </td>
                  <td className="px-4 py-2">
                    {e.receiptUrl ? (
                      <span className="inline-flex items-center gap-1 text-blue-600">
                        <Paperclip size={14} /> {e.receiptName || 'Παραστατικό'}
                      </span>
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
                <td className="px-4 py-2" colSpan={4}>
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

      {/* Λεπτομέρειες δαπάνης */}
      <Modal
        open={!!selectedExpense}
        onClose={() => setSelectedExpense(null)}
        title={selectedExpense?.category ?? 'Δαπάνη'}
        footer={
          <button
            onClick={() => setSelectedExpense(null)}
            className="rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
          >
            Κλείσιμο
          </button>
        }
      >
        {selectedExpense && (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              <Detail label="Μήνας" value={formatPeriod(selectedExpense.period)} />
              {selectedExpense.date && <Detail label="Ημ/νία παραστατικού" value={new Date(selectedExpense.date).toLocaleDateString('el-GR')} />}
              <Detail label="Ομάδα" value={GROUP_LABELS[selectedExpense.group]} />
              <Detail label="Επιμερισμός" value={ALLOCATION_LABELS[selectedExpense.method]} />
              <Detail label="Ποσό" value={money(selectedExpense.amount)} />
              {selectedExpense.code && <Detail label="Κωδικός" value={selectedExpense.code} />}
            </div>

            {Array.isArray(selectedExpense.participantApartmentIds) &&
              selectedExpense.participantApartmentIds.length > 0 && (
                <div>
                  <div className="text-xs uppercase text-gray-400">Συμμετέχοντα διαμερίσματα</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {selectedExpense.participantApartmentIds.map((id) => (
                      <Badge key={id} color="gray">
                        {aptCode(id)}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

            {selectedExpense.note && (
              <div>
                <div className="text-xs uppercase text-gray-400">Σημείωση</div>
                <p className="mt-0.5 whitespace-pre-wrap text-gray-700">{selectedExpense.note}</p>
              </div>
            )}

            <div>
              <div className="text-xs uppercase text-gray-400">Έγγραφο / Παραστατικό</div>
              {selectedExpense.receiptUrl ? (
                <a
                  href={selectedExpense.receiptUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-flex items-center gap-1.5 rounded-md border border-gray-200 px-3 py-2 text-blue-600 hover:bg-blue-50"
                >
                  <Download size={16} /> {selectedExpense.receiptName || 'Άνοιγμα παραστατικού'}
                </a>
              ) : (
                <p className="mt-0.5 text-gray-400">Δεν υπάρχει συνημμένο έγγραφο.</p>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase text-gray-400">{label}</div>
      <div className="font-medium text-gray-800">{value}</div>
    </div>
  )
}
