import { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2, Pencil, ArrowDownCircle, ArrowUpCircle, ArrowLeftRight } from 'lucide-react'
import { Timestamp } from 'firebase/firestore'
import { useAppData } from '@/lib/appData'
import { useAuth } from '@/lib/auth'
import { Button, Card, PageHeader, Field, TextField, NumberField, SelectField, Badge } from '@/components/forms'
import { Modal } from '@/components/Modal'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { money, formatDate, currentPeriod } from '@/lib/format'
import { GROUP_LABELS, PAYMENT_METHOD_LABELS } from '@/types'
import type { Expense, FundEntry, Payment } from '@/types'
import { listFundEntries, createFundEntry, updateFundEntry, deleteFundEntry, cashBalance } from '@/lib/repos/fund'
import { listPayments } from '@/lib/repos/payments'
import { listExpenses } from '@/lib/repos/expenses'
import { logAudit } from '@/lib/audit'

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

type PeriodView = 'month' | 'quarter' | 'year' | 'range' | 'all'
type SourceFilter = 'all' | 'payment' | 'expense' | 'fund'
type LedgerKind = 'payment' | 'expense' | 'fund'

interface LedgerRow {
  key: string
  kind: LedgerKind
  date: Date
  month: string // YYYY-MM
  label: string
  note: string
  signed: number // + έσοδο, − έξοδο
  transfer: boolean
  fundEntry?: FundEntry
}

function quarterMonths(year: string, q: number): string[] {
  const start = (q - 1) * 3 + 1
  return [0, 1, 2].map((i) => `${year}-${String(start + i).padStart(2, '0')}`)
}

function monthOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const emptyForm = {
  type: 'in' as 'in' | 'out',
  amount: 0,
  date: todayISO(),
  category: '',
  note: '',
  transfer: false,
}

export default function Fund() {
  const { building, apartments } = useAppData()
  const { isManager, user, profile } = useAuth()
  const [entries, setEntries] = useState<FundEntry[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<FundEntry | null>(null)
  const [toDelete, setToDelete] = useState<FundEntry | null>(null)
  const [form, setForm] = useState(emptyForm)

  // Φίλτρα
  const [view, setView] = useState<PeriodView>('month')
  const [month, setMonth] = useState(currentPeriod())
  const [year, setYear] = useState(currentPeriod().slice(0, 4))
  const [quarter, setQuarter] = useState(Math.floor(new Date().getMonth() / 3) + 1)
  const [from, setFrom] = useState(currentPeriod())
  const [to, setTo] = useState(currentPeriod())
  const [source, setSource] = useState<SourceFilter>('all')

  async function load() {
    if (!building) return
    setLoading(true)
    try {
      const [fe, pay, ex] = await Promise.all([
        listFundEntries(building.id),
        listPayments(building.id),
        listExpenses(building.id),
      ])
      setEntries(fe)
      setPayments(pay)
      setExpenses(ex)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [building])

  const aptCode = (id: string) => apartments.find((a) => a.id === id)?.code ?? '—'

  // Πραγματικό υπόλοιπο (όλων των εποχών).
  const balance = useMemo(() => cashBalance(payments, expenses, entries), [payments, expenses, entries])

  // Ενοποιημένο καθολικό.
  const allRows = useMemo<LedgerRow[]>(() => {
    const rows: LedgerRow[] = []
    for (const p of payments) {
      const d = p.date?.toDate?.() ?? new Date()
      rows.push({
        key: `p:${p.id}`, kind: 'payment', date: d, month: monthOf(d),
        label: `Πληρωμή · ${aptCode(p.apartmentId)}`,
        note: [PAYMENT_METHOD_LABELS[p.method], p.note].filter(Boolean).join(' · '),
        signed: p.amount || 0, transfer: false,
      })
    }
    for (const e of expenses) {
      const d = e.date ? new Date(e.date) : new Date(`${e.period}-01`)
      rows.push({
        key: `e:${e.id}`, kind: 'expense', date: d, month: e.period,
        label: e.category,
        note: [GROUP_LABELS[e.group], e.code].filter(Boolean).join(' · '),
        signed: -(e.amount || 0), transfer: false,
      })
    }
    for (const e of entries) {
      const d = e.date?.toDate?.() ?? new Date()
      rows.push({
        key: `f:${e.id}`, kind: 'fund', date: d, month: monthOf(d),
        label: e.category,
        note: e.note ?? '',
        signed: e.type === 'in' ? e.amount : -e.amount,
        transfer: !!e.transfer,
        fundEntry: e,
      })
    }
    return rows.sort((a, b) => b.date.getTime() - a.date.getTime())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payments, expenses, entries, apartments])

  const inPeriod = (m: string): boolean => {
    if (view === 'all') return true
    if (view === 'month') return m === month
    if (view === 'year') return m.startsWith(`${year}-`)
    if (view === 'quarter') return quarterMonths(year, quarter).includes(m)
    const f = from <= to ? from : to
    const t = from <= to ? to : from
    return m >= f && m <= t
  }

  const rows = useMemo(
    () => allRows.filter((r) => inPeriod(r.month) && (source === 'all' || r.kind === source)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allRows, view, month, year, quarter, from, to, source],
  )

  // Σύνολα περιόδου (οι μεταφορές δεν μετρούν).
  const periodIn = rows.filter((r) => !r.transfer && r.signed > 0).reduce((s, r) => s + r.signed, 0)
  const periodOut = rows.filter((r) => !r.transfer && r.signed < 0).reduce((s, r) => s - r.signed, 0)
  const periodNet = periodIn - periodOut

  function openNew() {
    setEditing(null)
    setForm(emptyForm)
    setModalOpen(true)
  }

  function openEdit(e: FundEntry) {
    setEditing(e)
    setForm({
      type: e.type,
      amount: e.amount,
      date: e.date?.toDate?.().toISOString().slice(0, 10) ?? todayISO(),
      category: e.category,
      note: e.note ?? '',
      transfer: !!e.transfer,
    })
    setModalOpen(true)
  }

  async function save() {
    if (!building) return
    const data = {
      buildingId: building.id,
      type: form.type,
      amount: Number(form.amount) || 0,
      date: Timestamp.fromDate(new Date(form.date)),
      category: form.category.trim() || (form.type === 'in' ? 'Είσπραξη' : 'Πληρωμή'),
      note: form.note.trim() || undefined,
      transfer: form.transfer || undefined,
    }
    if (editing) {
      await updateFundEntry(editing.id, {
        type: data.type,
        amount: data.amount,
        date: data.date,
        category: data.category,
        note: form.note.trim() ? form.note.trim() : null,
        transfer: form.transfer ? true : null,
      } as Partial<FundEntry>)
    } else {
      await createFundEntry(data)
    }
    await logAudit({
      buildingId: building.id,
      userEmail: user?.email ?? '',
      userName: profile?.name ?? user?.email ?? '',
      action: editing ? 'update' : 'create',
      entity: 'fundEntry',
      entityId: data.category,
      after: { type: data.type, amount: data.amount, transfer: !!data.transfer },
    })
    setModalOpen(false)
    setEditing(null)
    await load()
  }

  async function confirmDelete() {
    if (!toDelete) return
    await deleteFundEntry(toDelete.id)
    setToDelete(null)
    await load()
  }

  if (loading) return <div className="text-gray-400">Φόρτωση…</div>

  return (
    <div>
      <PageHeader
        title="Ταμείο / Αποθεματικό"
        subtitle={`Πραγματικό υπόλοιπο ${money(balance)}`}
        actions={
          isManager && (
            <Button onClick={openNew}>
              <Plus size={18} /> Νέα κίνηση
            </Button>
          )
        }
      />

      {/* Φίλτρα περιόδου + πηγής */}
      <Card className="mb-4">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-xs font-medium text-gray-500">Περίοδος:</span>
          <select
            value={view}
            onChange={(e) => setView(e.target.value as PeriodView)}
            className="rounded-md border border-gray-300 px-2 py-1 text-sm shadow-sm focus:border-blue-500 focus:outline-none"
          >
            <option value="month">Μήνας</option>
            <option value="quarter">Τρίμηνο</option>
            <option value="year">Έτος</option>
            <option value="range">Εύρος</option>
            <option value="all">Όλα</option>
          </select>
          {view === 'month' && (
            <input type="month" value={month} onChange={(e) => setMonth(e.target.value)}
              className="rounded-md border border-gray-300 px-2 py-1 text-sm shadow-sm focus:border-blue-500 focus:outline-none" />
          )}
          {view === 'quarter' && (
            <>
              <select value={quarter} onChange={(e) => setQuarter(Number(e.target.value))}
                className="rounded-md border border-gray-300 px-2 py-1 text-sm shadow-sm focus:border-blue-500 focus:outline-none">
                {[1, 2, 3, 4].map((q) => <option key={q} value={q}>{q}ο τρίμηνο</option>)}
              </select>
              <input type="number" value={year} onChange={(e) => setYear(e.target.value)}
                className="w-20 rounded-md border border-gray-300 px-2 py-1 text-sm shadow-sm focus:border-blue-500 focus:outline-none" />
            </>
          )}
          {view === 'year' && (
            <input type="number" value={year} onChange={(e) => setYear(e.target.value)}
              className="w-24 rounded-md border border-gray-300 px-2 py-1 text-sm shadow-sm focus:border-blue-500 focus:outline-none" />
          )}
          {view === 'range' && (
            <div className="flex items-center gap-1">
              <input type="month" value={from} onChange={(e) => setFrom(e.target.value)}
                className="rounded-md border border-gray-300 px-2 py-1 text-sm shadow-sm focus:border-blue-500 focus:outline-none" />
              <span className="text-gray-400">–</span>
              <input type="month" value={to} onChange={(e) => setTo(e.target.value)}
                className="rounded-md border border-gray-300 px-2 py-1 text-sm shadow-sm focus:border-blue-500 focus:outline-none" />
            </div>
          )}
          <span className="ml-2 text-xs font-medium text-gray-500">Πηγή:</span>
          <select
            value={source}
            onChange={(e) => setSource(e.target.value as SourceFilter)}
            className="rounded-md border border-gray-300 px-2 py-1 text-sm shadow-sm focus:border-blue-500 focus:outline-none"
          >
            <option value="all">Όλες</option>
            <option value="payment">Πληρωμές ενοίκων</option>
            <option value="expense">Δαπάνες</option>
            <option value="fund">Κινήσεις Ταμείου</option>
          </select>
        </div>
      </Card>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <div className="text-xs text-gray-500">Εισπράξεις (περιόδου)</div>
          <div className="tnum text-lg font-semibold text-green-700">{money(periodIn)}</div>
        </Card>
        <Card>
          <div className="text-xs text-gray-500">Έξοδα (περιόδου)</div>
          <div className="tnum text-lg font-semibold text-red-600">{money(periodOut)}</div>
        </Card>
        <Card>
          <div className="text-xs text-gray-500">Καθαρό περιόδου</div>
          <div className={`tnum text-lg font-semibold ${periodNet >= 0 ? 'text-gray-900' : 'text-red-600'}`}>{money(periodNet)}</div>
        </Card>
        <Card>
          <div className="text-xs text-gray-500">Πραγματικό υπόλοιπο</div>
          <div className="tnum text-lg font-semibold text-blue-700">{money(balance)}</div>
        </Card>
      </div>

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs uppercase text-gray-500">
              <th className="px-3 py-2">Ημ/νία</th>
              <th className="px-3 py-2">Πηγή</th>
              <th className="px-3 py-2">Περιγραφή</th>
              <th className="px-3 py-2">Σημείωση</th>
              <th className="px-3 py-2 text-right">Ποσό</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-gray-400">Καμία κίνηση για την περίοδο.</td>
              </tr>
            )}
            {rows.map((r) => {
              const income = r.signed > 0
              return (
                <tr key={r.key} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="whitespace-nowrap px-3 py-2 text-gray-600">{formatDate(r.date)}</td>
                  <td className="px-3 py-2">
                    {r.kind === 'payment' && <Badge color="green">Πληρωμή</Badge>}
                    {r.kind === 'expense' && <Badge color="red">Δαπάνη</Badge>}
                    {r.kind === 'fund' && (
                      r.transfer ? <Badge color="gray">Μεταφορά</Badge> : <Badge color="blue">Ταμείο</Badge>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center gap-1.5 text-gray-800">
                      {r.transfer ? (
                        <ArrowLeftRight size={15} className="text-gray-400" />
                      ) : income ? (
                        <ArrowDownCircle size={15} className="text-green-600" />
                      ) : (
                        <ArrowUpCircle size={15} className="text-red-500" />
                      )}
                      {r.label}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-gray-500">{r.note}</td>
                  <td className={`px-3 py-2 text-right tnum font-medium ${r.transfer ? 'text-gray-400' : income ? 'text-green-700' : 'text-red-600'}`}>
                    {r.transfer ? '' : income ? '+' : '−'}{money(Math.abs(r.signed))}
                  </td>
                  <td className="px-3 py-2">
                    {isManager && r.kind === 'fund' && r.fundEntry && (
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(r.fundEntry!)}
                          className="rounded p-1 text-gray-300 hover:bg-gray-100 hover:text-blue-600" title="Επεξεργασία">
                          <Pencil size={15} />
                        </button>
                        <button onClick={() => setToDelete(r.fundEntry!)}
                          className="rounded p-1 text-gray-300 hover:bg-gray-100 hover:text-red-600" title="Διαγραφή">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </Card>

      <p className="mt-2 text-xs text-gray-400">
        Το καθολικό συγκεντρώνει πληρωμές ενοίκων (έσοδα), δαπάνες (έξοδα) και χειροκίνητες κινήσεις Ταμείου. Οι εσωτερικές
        μεταφορές (π.χ. κατάθεση μετρητών ταμείου στην τράπεζα) εμφανίζονται αλλά δεν μετρούν στο υπόλοιπο, για να μη
        διπλομετρηθούν. Πληρωμές &amp; δαπάνες επεξεργάζονται από τις αντίστοιχες σελίδες τους.
      </p>

      <Modal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(null) }}
        title={editing ? 'Επεξεργασία κίνησης ταμείου' : 'Νέα κίνηση ταμείου'}
        footer={
          <>
            <Button variant="secondary" onClick={() => { setModalOpen(false); setEditing(null) }}>Ακύρωση</Button>
            <Button onClick={save}>Αποθήκευση</Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Τύπος">
            <SelectField value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as 'in' | 'out' })}>
              <option value="in">Είσπραξη (+)</option>
              <option value="out">Πληρωμή (−)</option>
            </SelectField>
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Ποσό (€)">
              <NumberField step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} />
            </Field>
            <Field label="Ημερομηνία">
              <TextField type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </Field>
          </div>
          <Field label="Κατηγορία">
            <TextField placeholder="π.χ. Επιστροφή ΔΕΗ / Τόκοι / Αρχικό αποθεματικό"
              value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
          </Field>
          <Field label="Σημείωση (προαιρετικό)">
            <TextField value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </Field>
          <label className="flex items-start gap-2 rounded-md bg-gray-50 p-2 text-sm">
            <input type="checkbox" className="mt-0.5" checked={form.transfer}
              onChange={(e) => setForm({ ...form, transfer: e.target.checked })} />
            <span>
              <span className="font-medium text-gray-700">Εσωτερική μεταφορά</span>
              <span className="block text-xs text-gray-500">
                π.χ. κατάθεση μετρητών ταμείου στην τράπεζα. Εμφανίζεται αλλά δεν μετρά στο υπόλοιπο (τα μετρητά
                καταχωρούνται ήδη ως πληρωμές).
              </span>
            </span>
          </label>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!toDelete}
        message="Διαγραφή κίνησης ταμείου;"
        onCancel={() => setToDelete(null)}
        onConfirm={confirmDelete}
      />
    </div>
  )
}
