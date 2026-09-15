import { useEffect, useMemo, useState } from 'react'
import { Plus, Pencil, Trash2, Search, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react'
import { Timestamp } from 'firebase/firestore'
import { useAppData } from '@/lib/appData'
import { useAuth } from '@/lib/auth'
import { Button, Card, PageHeader, Field, TextField, NumberField, SelectField, Badge } from '@/components/forms'
import { Modal } from '@/components/Modal'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { money, formatDate, compareEl } from '@/lib/format'
import type { Payment, PaymentMethod } from '@/types'
import { PAYMENT_METHOD_LABELS } from '@/types'
import { listPayments, createPayment, updatePayment, deletePayment } from '@/lib/repos/payments'
import { logAudit } from '@/lib/audit'

type SortKey = 'date' | 'apartment' | 'method' | 'note' | 'amount'

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

/** Timestamp/Date → YYYY-MM-DD για το input ημερομηνίας. */
function toISODate(d: Payment['date']): string {
  const dt = d?.toDate?.() ?? (d ? new Date(d as unknown as string) : new Date())
  return dt.toISOString().slice(0, 10)
}

export default function Payments() {
  const { building, apartments } = useAppData()
  const { isManager, user, profile } = useAuth()
  const [payments, setPayments] = useState<Payment[]>([])
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Payment | null>(null)
  const [toDelete, setToDelete] = useState<Payment | null>(null)
  const [form, setForm] = useState({
    apartmentId: '',
    amount: 0,
    date: todayISO(),
    method: 'cash' as PaymentMethod,
    note: '',
  })

  async function load() {
    if (!building) return
    setPayments(await listPayments(building.id))
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [building])

  const aptCode = useMemo(() => {
    const m: Record<string, string> = {}
    for (const a of apartments) m[a.id] = a.code
    return m
  }, [apartments])

  const aptOwner = useMemo(() => {
    const m: Record<string, string> = {}
    for (const a of apartments) m[a.id] = a.ownerName ?? ''
    return m
  }, [apartments])

  function openNew() {
    setEditing(null)
    setForm({
      apartmentId: apartments[0]?.id ?? '',
      amount: 0,
      date: todayISO(),
      method: 'cash',
      note: '',
    })
    setModalOpen(true)
  }

  function openEdit(p: Payment) {
    setEditing(p)
    setForm({
      apartmentId: p.apartmentId,
      amount: p.amount,
      date: toISODate(p.date),
      method: p.method,
      note: p.note ?? '',
    })
    setModalOpen(true)
  }

  async function save() {
    if (!building || !form.apartmentId) return
    const data = {
      buildingId: building.id,
      apartmentId: form.apartmentId,
      amount: Number(form.amount) || 0,
      date: Timestamp.fromDate(new Date(form.date)),
      method: form.method,
      note: form.note.trim() || undefined,
    }
    if (editing) {
      await updatePayment(editing.id, data)
    } else {
      await createPayment(data)
    }
    await logAudit({
      buildingId: building.id,
      userEmail: user?.email ?? '',
      userName: profile?.name ?? user?.email ?? '',
      action: editing ? 'update' : 'create',
      entity: 'payment',
      entityId: editing?.id ?? form.apartmentId,
      after: { amount: data.amount, apartment: aptCode[form.apartmentId] },
    })
    setModalOpen(false)
    setEditing(null)
    await load()
  }

  async function confirmDelete() {
    if (!toDelete) return
    await deletePayment(toDelete.id)
    setToDelete(null)
    await load()
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      // Οι αριθμοί/ημερομηνίες ξεκινούν φθίνουσα, το κείμενο αύξουσα.
      setSortDir(key === 'amount' || key === 'date' ? 'desc' : 'asc')
    }
  }

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    const filtered = q
      ? payments.filter((p) => {
          const hay = [
            aptCode[p.apartmentId] ?? '',
            aptOwner[p.apartmentId] ?? '',
            PAYMENT_METHOD_LABELS[p.method],
            p.note ?? '',
            String(p.amount),
            formatDate(p.date),
          ]
            .join(' ')
            .toLowerCase()
          return hay.includes(q)
        })
      : payments
    const dir = sortDir === 'asc' ? 1 : -1
    const sorted = [...filtered].sort((a, b) => {
      switch (sortKey) {
        case 'amount':
          return (a.amount - b.amount) * dir
        case 'apartment':
          return compareEl(aptCode[a.apartmentId] ?? '', aptCode[b.apartmentId] ?? '') * dir
        case 'method':
          return compareEl(PAYMENT_METHOD_LABELS[a.method], PAYMENT_METHOD_LABELS[b.method]) * dir
        case 'note':
          return compareEl(a.note ?? '', b.note ?? '') * dir
        case 'date':
        default:
          return ((a.date?.toMillis?.() ?? 0) - (b.date?.toMillis?.() ?? 0)) * dir
      }
    })
    return sorted
  }, [payments, search, sortKey, sortDir, aptCode, aptOwner])

  const total = rows.reduce((s, p) => s + p.amount, 0)

  return (
    <div>
      <PageHeader
        title="Πληρωμές"
        subtitle={
          search.trim()
            ? `${rows.length} από ${payments.length} · σύνολο ${money(total)}`
            : `${payments.length} εισπράξεις · σύνολο ${money(total)}`
        }
        actions={
          isManager && (
            <Button onClick={openNew}>
              <Plus size={18} /> Νέα πληρωμή
            </Button>
          )
        }
      />

      <div className="mb-3 relative max-w-sm">
        <Search size={16} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <TextField
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Αναζήτηση (διαμέρισμα, ιδιοκτήτης, σημείωση, ποσό…)"
          className="pl-8"
        />
      </div>

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs uppercase text-gray-500">
              <SortTh label="Ημ/νία" k="date" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <SortTh label="Διαμ." k="apartment" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <SortTh label="Τρόπος" k="method" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <SortTh label="Σημείωση" k="note" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <SortTh label="Ποσό" k="amount" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} align="right" />
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-gray-400">
                  {search.trim() ? 'Κανένα αποτέλεσμα.' : 'Δεν υπάρχουν πληρωμές.'}
                </td>
              </tr>
            )}
            {rows.map((p) => (
              <tr key={p.id} className="border-t border-gray-100 hover:bg-gray-50">
                <td className="px-3 py-2 text-gray-600">{formatDate(p.date)}</td>
                <td className="px-3 py-2">
                  <div className="font-medium text-gray-900">{aptCode[p.apartmentId] ?? '—'}</div>
                  {aptOwner[p.apartmentId] && (
                    <div className="text-xs text-gray-500">{aptOwner[p.apartmentId]}</div>
                  )}
                </td>
                <td className="px-3 py-2">
                  <Badge>{PAYMENT_METHOD_LABELS[p.method]}</Badge>
                </td>
                <td className="px-3 py-2 text-gray-500">{p.note ?? ''}</td>
                <td className="px-3 py-2 text-right tnum font-medium text-green-700">{money(p.amount)}</td>
                <td className="px-3 py-2">
                  {isManager && (
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => openEdit(p)}
                        className="rounded p-1 text-gray-300 hover:bg-gray-100 hover:text-blue-600"
                        title="Επεξεργασία"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={() => setToDelete(p)}
                        className="rounded p-1 text-gray-300 hover:bg-gray-100 hover:text-red-600"
                        title="Διαγραφή"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(null) }}
        title={editing ? 'Επεξεργασία πληρωμής' : 'Νέα πληρωμή'}
        footer={
          <>
            <Button variant="secondary" onClick={() => { setModalOpen(false); setEditing(null) }}>
              Ακύρωση
            </Button>
            <Button onClick={save}>Αποθήκευση</Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Διαμέρισμα">
            <SelectField
              value={form.apartmentId}
              onChange={(e) => setForm({ ...form, apartmentId: e.target.value })}
            >
              {apartments.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.code} — {a.ownerName}
                </option>
              ))}
            </SelectField>
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Ποσό (€)">
              <NumberField
                step="0.01"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
              />
            </Field>
            <Field label="Ημερομηνία">
              <TextField type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </Field>
          </div>
          <Field label="Τρόπος πληρωμής">
            <SelectField
              value={form.method}
              onChange={(e) => setForm({ ...form, method: e.target.value as PaymentMethod })}
            >
              {(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map((m) => (
                <option key={m} value={m}>
                  {PAYMENT_METHOD_LABELS[m]}
                </option>
              ))}
            </SelectField>
          </Field>
          <Field label="Σημείωση (προαιρετικό)">
            <TextField value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </Field>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!toDelete}
        message="Διαγραφή πληρωμής;"
        onCancel={() => setToDelete(null)}
        onConfirm={confirmDelete}
      />
    </div>
  )
}

function SortTh({
  label,
  k,
  sortKey,
  sortDir,
  onSort,
  align = 'left',
}: {
  label: string
  k: SortKey
  sortKey: SortKey
  sortDir: 'asc' | 'desc'
  onSort: (k: SortKey) => void
  align?: 'left' | 'right'
}) {
  const active = sortKey === k
  const Icon = !active ? ArrowUpDown : sortDir === 'asc' ? ArrowUp : ArrowDown
  return (
    <th className="px-3 py-2">
      <button
        onClick={() => onSort(k)}
        className={`inline-flex items-center gap-1 uppercase hover:text-gray-700 ${
          align === 'right' ? 'w-full justify-end' : ''
        } ${active ? 'text-gray-700' : ''}`}
      >
        {label}
        <Icon size={13} className={active ? 'text-blue-500' : 'text-gray-300'} />
      </button>
    </th>
  )
}
