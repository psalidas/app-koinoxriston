import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, AlertTriangle } from 'lucide-react'
import { Timestamp } from 'firebase/firestore'
import { useAppData } from '@/lib/appData'
import { useAuth } from '@/lib/auth'
import { Button, Card, PageHeader, Field, TextField, NumberField, Badge } from '@/components/forms'
import { Modal } from '@/components/Modal'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { money, formatDate } from '@/lib/format'
import type { Contract } from '@/types'
import { listContracts, createContract, updateContract, deleteContract, daysUntil } from '@/lib/repos/contracts'
import { logAudit } from '@/lib/audit'

function toISO(ts?: Timestamp): string {
  const ms = ts?.toMillis?.()
  return ms ? new Date(ms).toISOString().slice(0, 10) : ''
}

const CATEGORIES = ['Ανελκυστήρας', 'Καυστήρας/Θέρμανση', 'Πυρασφάλεια', 'Καθαρισμός', 'Ασφάλιση', 'Άλλο']

export default function Contracts() {
  const { building } = useAppData()
  const { user, profile } = useAuth()
  const [items, setItems] = useState<Contract[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Contract | null>(null)
  const [toDelete, setToDelete] = useState<Contract | null>(null)
  const [form, setForm] = useState({
    title: '',
    vendor: '',
    category: CATEGORIES[0],
    startDate: '',
    endDate: '',
    amount: 0,
    reminderDays: 30,
    note: '',
  })

  async function load() {
    if (!building) return
    setItems(await listContracts(building.id))
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [building])

  function openNew() {
    setEditing(null)
    setForm({ title: '', vendor: '', category: CATEGORIES[0], startDate: '', endDate: '', amount: 0, reminderDays: 30, note: '' })
    setModalOpen(true)
  }

  function openEdit(c: Contract) {
    setEditing(c)
    setForm({
      title: c.title,
      vendor: c.vendor ?? '',
      category: c.category,
      startDate: toISO(c.startDate),
      endDate: toISO(c.endDate),
      amount: c.amount ?? 0,
      reminderDays: c.reminderDays ?? 30,
      note: c.note ?? '',
    })
    setModalOpen(true)
  }

  async function save() {
    if (!building) return
    const data = {
      buildingId: building.id,
      title: form.title.trim(),
      vendor: form.vendor.trim() || undefined,
      category: form.category,
      startDate: form.startDate ? Timestamp.fromDate(new Date(form.startDate)) : undefined,
      endDate: form.endDate ? Timestamp.fromDate(new Date(form.endDate)) : undefined,
      amount: Number(form.amount) || undefined,
      reminderDays: Number(form.reminderDays) || 30,
      note: form.note.trim() || undefined,
    }
    if (editing) await updateContract(editing.id, data)
    else await createContract(data)
    await logAudit({
      buildingId: building.id,
      userEmail: user?.email ?? '',
      userName: profile?.name ?? user?.email ?? '',
      action: editing ? 'update' : 'create',
      entity: 'contract',
      entityId: editing?.id ?? data.title,
    })
    setModalOpen(false)
    await load()
  }

  async function confirmDelete() {
    if (!toDelete) return
    await deleteContract(toDelete.id)
    setToDelete(null)
    await load()
  }

  function expiryBadge(c: Contract) {
    const d = daysUntil(c)
    if (d === null) return null
    if (d < 0) return <Badge color="red">Έληξε</Badge>
    if (d <= (c.reminderDays ?? 30)) return <Badge color="amber">Λήγει σε {d} ημ.</Badge>
    return <Badge color="green">Σε ισχύ</Badge>
  }

  return (
    <div>
      <PageHeader
        title="Συμβόλαια / Συντηρήσεις"
        subtitle="Μητρώο με ημερομηνίες λήξης & υπενθυμίσεις"
        actions={
          <Button onClick={openNew}>
            <Plus size={18} /> Νέο συμβόλαιο
          </Button>
        }
      />

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs uppercase text-gray-500">
              <th className="px-3 py-2">Τίτλος</th>
              <th className="px-3 py-2">Πάροχος</th>
              <th className="px-3 py-2">Λήξη</th>
              <th className="px-3 py-2 text-right">Ποσό</th>
              <th className="px-3 py-2">Κατάσταση</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-gray-400">
                  Δεν υπάρχουν συμβόλαια.
                </td>
              </tr>
            )}
            {items.map((c) => (
              <tr key={c.id} className="border-t border-gray-100 hover:bg-gray-50">
                <td className="px-3 py-2">
                  <div className="font-medium text-gray-900">{c.title}</div>
                  <div className="text-xs text-gray-400">{c.category}</div>
                </td>
                <td className="px-3 py-2 text-gray-600">{c.vendor ?? '—'}</td>
                <td className="px-3 py-2 text-gray-600">{formatDate(c.endDate)}</td>
                <td className="px-3 py-2 text-right tnum">{c.amount ? money(c.amount) : '—'}</td>
                <td className="px-3 py-2">{expiryBadge(c)}</td>
                <td className="px-3 py-2">
                  <div className="flex justify-end gap-1">
                    <button
                      onClick={() => openEdit(c)}
                      className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-blue-600"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => setToDelete(c)}
                      className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-red-600"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Επεξεργασία συμβολαίου' : 'Νέο συμβόλαιο'}
        wide
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Ακύρωση
            </Button>
            <Button onClick={save}>Αποθήκευση</Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Τίτλος">
            <TextField value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </Field>
          <Field label="Πάροχος / Συνεργείο">
            <TextField value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} />
          </Field>
          <Field label="Κατηγορία">
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Ετήσιο/συνολικό ποσό (€)">
            <NumberField step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} />
          </Field>
          <Field label="Έναρξη">
            <TextField type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
          </Field>
          <Field label="Λήξη">
            <TextField type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
          </Field>
          <Field label="Υπενθύμιση (ημέρες πριν τη λήξη)">
            <NumberField value={form.reminderDays} onChange={(e) => setForm({ ...form, reminderDays: Number(e.target.value) })} />
          </Field>
          <Field label="Σημείωση">
            <TextField value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </Field>
        </div>
        <p className="mt-3 flex items-center gap-1.5 text-xs text-gray-400">
          <AlertTriangle size={14} /> Οι υπενθυμίσεις εμφανίζονται στον Πίνακα ελέγχου.
        </p>
      </Modal>

      <ConfirmDialog
        open={!!toDelete}
        message={`Διαγραφή συμβολαίου «${toDelete?.title}»;`}
        onCancel={() => setToDelete(null)}
        onConfirm={confirmDelete}
      />
    </div>
  )
}
