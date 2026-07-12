import { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Timestamp } from 'firebase/firestore'
import { useAppData } from '@/lib/appData'
import { useAuth } from '@/lib/auth'
import { Button, Card, PageHeader, Field, TextField, NumberField, SelectField, Badge } from '@/components/forms'
import { Modal } from '@/components/Modal'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { money, formatDate } from '@/lib/format'
import type { Payment, PaymentMethod } from '@/types'
import { PAYMENT_METHOD_LABELS } from '@/types'
import { listPayments, createPayment, deletePayment } from '@/lib/repos/payments'
import { logAudit } from '@/lib/audit'

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

export default function Payments() {
  const { building, apartments } = useAppData()
  const { isManager, user, profile } = useAuth()
  const [payments, setPayments] = useState<Payment[]>([])
  const [modalOpen, setModalOpen] = useState(false)
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

  function openNew() {
    setForm({
      apartmentId: apartments[0]?.id ?? '',
      amount: 0,
      date: todayISO(),
      method: 'cash',
      note: '',
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
    await createPayment(data)
    await logAudit({
      buildingId: building.id,
      userEmail: user?.email ?? '',
      userName: profile?.name ?? user?.email ?? '',
      action: 'create',
      entity: 'payment',
      entityId: form.apartmentId,
      after: { amount: data.amount, apartment: aptCode[form.apartmentId] },
    })
    setModalOpen(false)
    await load()
  }

  async function confirmDelete() {
    if (!toDelete) return
    await deletePayment(toDelete.id)
    setToDelete(null)
    await load()
  }

  const total = payments.reduce((s, p) => s + p.amount, 0)

  return (
    <div>
      <PageHeader
        title="Πληρωμές"
        subtitle={`${payments.length} εισπράξεις · σύνολο ${money(total)}`}
        actions={
          isManager && (
            <Button onClick={openNew}>
              <Plus size={18} /> Νέα πληρωμή
            </Button>
          )
        }
      />

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs uppercase text-gray-500">
              <th className="px-3 py-2">Ημ/νία</th>
              <th className="px-3 py-2">Διαμ.</th>
              <th className="px-3 py-2">Τρόπος</th>
              <th className="px-3 py-2">Σημείωση</th>
              <th className="px-3 py-2 text-right">Ποσό</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {payments.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-gray-400">
                  Δεν υπάρχουν πληρωμές.
                </td>
              </tr>
            )}
            {payments.map((p) => (
              <tr key={p.id} className="border-t border-gray-100 hover:bg-gray-50">
                <td className="px-3 py-2 text-gray-600">{formatDate(p.date)}</td>
                <td className="px-3 py-2 font-medium text-gray-900">{aptCode[p.apartmentId] ?? '—'}</td>
                <td className="px-3 py-2">
                  <Badge>{PAYMENT_METHOD_LABELS[p.method]}</Badge>
                </td>
                <td className="px-3 py-2 text-gray-500">{p.note ?? ''}</td>
                <td className="px-3 py-2 text-right tnum font-medium text-green-700">{money(p.amount)}</td>
                <td className="px-3 py-2">
                  {isManager && (
                    <button
                      onClick={() => setToDelete(p)}
                      className="rounded p-1 text-gray-300 hover:bg-gray-100 hover:text-red-600"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Νέα πληρωμή"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
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
