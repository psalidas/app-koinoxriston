import { useEffect, useState } from 'react'
import { Plus, Trash2, ArrowDownCircle, ArrowUpCircle } from 'lucide-react'
import { Timestamp } from 'firebase/firestore'
import { useAppData } from '@/lib/appData'
import { useAuth } from '@/lib/auth'
import { Button, Card, PageHeader, Field, TextField, NumberField, SelectField } from '@/components/forms'
import { Modal } from '@/components/Modal'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { money, formatDate } from '@/lib/format'
import type { FundEntry } from '@/types'
import { listFundEntries, createFundEntry, deleteFundEntry, fundBalance } from '@/lib/repos/fund'
import { logAudit } from '@/lib/audit'

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

export default function Fund() {
  const { building } = useAppData()
  const { isManager, user, profile } = useAuth()
  const [entries, setEntries] = useState<FundEntry[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [toDelete, setToDelete] = useState<FundEntry | null>(null)
  const [form, setForm] = useState({
    type: 'in' as 'in' | 'out',
    amount: 0,
    date: todayISO(),
    category: '',
    note: '',
  })

  async function load() {
    if (!building) return
    setEntries(await listFundEntries(building.id))
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [building])

  async function save() {
    if (!building) return
    const data = {
      buildingId: building.id,
      type: form.type,
      amount: Number(form.amount) || 0,
      date: Timestamp.fromDate(new Date(form.date)),
      category: form.category.trim() || (form.type === 'in' ? 'Είσπραξη' : 'Πληρωμή'),
      note: form.note.trim() || undefined,
    }
    await createFundEntry(data)
    await logAudit({
      buildingId: building.id,
      userEmail: user?.email ?? '',
      userName: profile?.name ?? user?.email ?? '',
      action: 'create',
      entity: 'fundEntry',
      entityId: data.category,
      after: { type: data.type, amount: data.amount },
    })
    setModalOpen(false)
    await load()
  }

  async function confirmDelete() {
    if (!toDelete) return
    await deleteFundEntry(toDelete.id)
    setToDelete(null)
    await load()
  }

  const balance = fundBalance(entries)
  const totalIn = entries.filter((e) => e.type === 'in').reduce((s, e) => s + e.amount, 0)
  const totalOut = entries.filter((e) => e.type === 'out').reduce((s, e) => s + e.amount, 0)

  return (
    <div>
      <PageHeader
        title="Ταμείο / Αποθεματικό"
        subtitle={`Υπόλοιπο ${money(balance)}`}
        actions={
          isManager && (
            <Button onClick={() => setModalOpen(true)}>
              <Plus size={18} /> Νέα κίνηση
            </Button>
          )
        }
      />

      <div className="mb-4 grid grid-cols-3 gap-3">
        <Card>
          <div className="text-xs text-gray-500">Εισπράξεις</div>
          <div className="tnum text-lg font-semibold text-green-700">{money(totalIn)}</div>
        </Card>
        <Card>
          <div className="text-xs text-gray-500">Πληρωμές</div>
          <div className="tnum text-lg font-semibold text-red-600">{money(totalOut)}</div>
        </Card>
        <Card>
          <div className="text-xs text-gray-500">Υπόλοιπο</div>
          <div className="tnum text-lg font-semibold text-gray-900">{money(balance)}</div>
        </Card>
      </div>

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs uppercase text-gray-500">
              <th className="px-3 py-2">Ημ/νία</th>
              <th className="px-3 py-2">Κατηγορία</th>
              <th className="px-3 py-2">Σημείωση</th>
              <th className="px-3 py-2 text-right">Ποσό</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-gray-400">
                  Καμία κίνηση.
                </td>
              </tr>
            )}
            {entries.map((e) => (
              <tr key={e.id} className="border-t border-gray-100 hover:bg-gray-50">
                <td className="px-3 py-2 text-gray-600">{formatDate(e.date)}</td>
                <td className="px-3 py-2">
                  <span className="inline-flex items-center gap-1.5 text-gray-800">
                    {e.type === 'in' ? (
                      <ArrowDownCircle size={16} className="text-green-600" />
                    ) : (
                      <ArrowUpCircle size={16} className="text-red-500" />
                    )}
                    {e.category}
                  </span>
                </td>
                <td className="px-3 py-2 text-gray-500">{e.note ?? ''}</td>
                <td className={`px-3 py-2 text-right tnum font-medium ${e.type === 'in' ? 'text-green-700' : 'text-red-600'}`}>
                  {e.type === 'in' ? '+' : '−'}
                  {money(e.amount)}
                </td>
                <td className="px-3 py-2">
                  {isManager && (
                    <button
                      onClick={() => setToDelete(e)}
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
        title="Νέα κίνηση ταμείου"
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
          <Field label="Τύπος">
            <SelectField
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as 'in' | 'out' })}
            >
              <option value="in">Είσπραξη (+)</option>
              <option value="out">Πληρωμή (−)</option>
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
          <Field label="Κατηγορία">
            <TextField
              placeholder="π.χ. Είσπραξη κοινοχρήστων"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            />
          </Field>
          <Field label="Σημείωση (προαιρετικό)">
            <TextField value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </Field>
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
