import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Pencil, Trash2, ChevronRight } from 'lucide-react'
import { useAppData } from '@/lib/appData'
import { useAuth } from '@/lib/auth'
import { Button, Card, PageHeader, Field, TextField, NumberField, Badge } from '@/components/forms'
import { Modal } from '@/components/Modal'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { money } from '@/lib/format'
import type { Apartment } from '@/types'
import { createApartment, updateApartment, deleteApartment } from '@/lib/repos/apartments'
import { listStatements } from '@/lib/repos/statements'
import { listPayments } from '@/lib/repos/payments'
import { balancesByApartment } from '@/lib/balances'
import { logAudit } from '@/lib/audit'

type FormState = {
  code: string
  orderNo: number
  ownerName: string
  tenantName: string
  closed: boolean
  millesimes: Record<string, number>
}

const emptyForm = (): FormState => ({
  code: '',
  orderNo: 0,
  ownerName: '',
  tenantName: '',
  closed: false,
  millesimes: {},
})

export default function Apartments() {
  const { building, apartments, refresh } = useAppData()
  const { isManager, user, profile } = useAuth()
  const [balances, setBalances] = useState<Record<string, number>>({})
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Apartment | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm())
  const [toDelete, setToDelete] = useState<Apartment | null>(null)

  useEffect(() => {
    if (!building) return
    void (async () => {
      const [statements, payments] = await Promise.all([
        listStatements(building.id),
        listPayments(building.id),
      ])
      setBalances(balancesByApartment(statements, payments))
    })()
  }, [building, apartments])

  const scales = building?.scales ?? []

  function openNew() {
    setEditing(null)
    setForm({ ...emptyForm(), orderNo: apartments.length + 1 })
    setModalOpen(true)
  }

  function openEdit(a: Apartment) {
    setEditing(a)
    setForm({
      code: a.code,
      orderNo: a.orderNo,
      ownerName: a.ownerName,
      tenantName: a.tenantName ?? '',
      closed: !!a.closed,
      millesimes: { ...a.millesimes },
    })
    setModalOpen(true)
  }

  async function save() {
    if (!building) return
    const data = {
      buildingId: building.id,
      code: form.code.trim(),
      orderNo: Number(form.orderNo) || 0,
      ownerName: form.ownerName.trim(),
      tenantName: form.tenantName.trim() || undefined,
      closed: form.closed,
      millesimes: form.millesimes,
    }
    if (editing) {
      await updateApartment(editing.id, data)
    } else {
      await createApartment(data)
    }
    await logAudit({
      buildingId: building.id,
      userEmail: user?.email ?? '',
      userName: profile?.name ?? user?.email ?? '',
      action: editing ? 'update' : 'create',
      entity: 'apartment',
      entityId: editing?.id ?? data.code,
      after: data,
    })
    setModalOpen(false)
    await refresh()
  }

  async function confirmDelete() {
    if (!toDelete || !building) return
    await deleteApartment(toDelete.id)
    await logAudit({
      buildingId: building.id,
      userEmail: user?.email ?? '',
      userName: profile?.name ?? user?.email ?? '',
      action: 'delete',
      entity: 'apartment',
      entityId: toDelete.id,
      before: { code: toDelete.code, ownerName: toDelete.ownerName },
    })
    setToDelete(null)
    await refresh()
  }

  const totalOwed = useMemo(
    () => Object.values(balances).reduce((s, v) => s + (v > 0 ? v : 0), 0),
    [balances],
  )

  return (
    <div>
      <PageHeader
        title="Διαμερίσματα"
        subtitle={`${apartments.length} διαμερίσματα · οφειλές ${money(totalOwed)}`}
        actions={
          isManager && (
            <Button onClick={openNew}>
              <Plus size={18} /> Νέο διαμέρισμα
            </Button>
          )
        }
      />

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs uppercase text-gray-500">
              <th className="px-3 py-2">Α/Α</th>
              <th className="px-3 py-2">Διαμ.</th>
              <th className="px-3 py-2">Ιδιοκτήτης</th>
              <th className="px-3 py-2 text-right">Υπόλοιπο</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {apartments.map((a) => {
              const bal = balances[a.id] ?? 0
              return (
                <tr key={a.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-3 py-2 tnum text-gray-500">{a.orderNo}</td>
                  <td className="px-3 py-2 font-medium text-gray-900">
                    {a.code} {a.closed && <Badge>κλειστό</Badge>}
                  </td>
                  <td className="px-3 py-2 text-gray-700">{a.ownerName}</td>
                  <td className="px-3 py-2 text-right tnum">
                    <span className={bal > 0 ? 'text-red-600' : bal < 0 ? 'text-green-600' : 'text-gray-500'}>
                      {money(bal)}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        to={`/apartments/${a.id}/ledger`}
                        className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-blue-600"
                        title="Καρτέλα"
                      >
                        <ChevronRight size={18} />
                      </Link>
                      {isManager && (
                        <>
                          <button
                            onClick={() => openEdit(a)}
                            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-blue-600"
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            onClick={() => setToDelete(a)}
                            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-red-600"
                          >
                            <Trash2 size={16} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? `Επεξεργασία ${editing.code}` : 'Νέο διαμέρισμα'}
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
          <Field label="Κωδικός διαμ. (π.χ. Α1)">
            <TextField value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
          </Field>
          <Field label="Α/Α">
            <NumberField
              value={form.orderNo}
              onChange={(e) => setForm({ ...form, orderNo: Number(e.target.value) })}
            />
          </Field>
          <Field label="Ιδιοκτήτης">
            <TextField value={form.ownerName} onChange={(e) => setForm({ ...form, ownerName: e.target.value })} />
          </Field>
          <Field label="Ένοικος (προαιρετικό)">
            <TextField value={form.tenantName} onChange={(e) => setForm({ ...form, tenantName: e.target.value })} />
          </Field>
        </div>

        <label className="mt-3 flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={form.closed}
            onChange={(e) => setForm({ ...form, closed: e.target.checked })}
          />
          Κλειστό διαμέρισμα (επηρεάζει τον επιμερισμό θέρμανσης)
        </label>

        <div className="mt-4">
          <h3 className="mb-2 text-sm font-semibold text-gray-700">Χιλιοστά</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {scales.map((s) => (
              <Field key={s.key} label={s.label}>
                <NumberField
                  step="0.1"
                  value={form.millesimes[s.key] ?? 0}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      millesimes: { ...form.millesimes, [s.key]: Number(e.target.value) },
                    })
                  }
                />
              </Field>
            ))}
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!toDelete}
        message={`Διαγραφή διαμερίσματος ${toDelete?.code}; Η ενέργεια δεν αναιρείται.`}
        onCancel={() => setToDelete(null)}
        onConfirm={confirmDelete}
      />
    </div>
  )
}
