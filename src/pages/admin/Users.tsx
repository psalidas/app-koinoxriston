import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { useAppData } from '@/lib/appData'
import { useAuth } from '@/lib/auth'
import { Button, Card, PageHeader, Field, TextField, SelectField, Badge } from '@/components/forms'
import { Modal } from '@/components/Modal'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import type { Role, UserDoc } from '@/types'
import { ROLE_LABELS } from '@/types'
import { listUsers, saveUser, deleteUser } from '@/lib/repos/users'
import { logAudit } from '@/lib/audit'

const emptyForm = () => ({
  email: '',
  name: '',
  role: 'owner' as Role,
  phone: '',
  active: true,
  apartmentIds: [] as string[],
})

export default function Users() {
  const { building, apartments } = useAppData()
  const { user, profile } = useAuth()
  const [users, setUsers] = useState<UserDoc[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<UserDoc | null>(null)
  const [form, setForm] = useState(emptyForm())
  const [toDelete, setToDelete] = useState<UserDoc | null>(null)

  async function load() {
    setUsers(await listUsers())
  }

  useEffect(() => {
    void load()
  }, [])

  function openNew() {
    setEditing(null)
    setForm(emptyForm())
    setModalOpen(true)
  }

  function openEdit(u: UserDoc) {
    setEditing(u)
    setForm({
      email: u.email,
      name: u.name,
      role: u.role,
      phone: u.phone ?? '',
      active: u.active !== false,
      apartmentIds: u.apartmentIds ?? [],
    })
    setModalOpen(true)
  }

  function toggleApartment(id: string) {
    setForm((f) => ({
      ...f,
      apartmentIds: f.apartmentIds.includes(id)
        ? f.apartmentIds.filter((x) => x !== id)
        : [...f.apartmentIds, id],
    }))
  }

  async function save() {
    const email = form.email.trim().toLowerCase()
    if (!email) return
    await saveUser(email, {
      name: form.name.trim(),
      role: form.role,
      phone: form.phone.trim() || undefined,
      active: form.active,
      buildingIds: building ? [building.id] : [],
      apartmentIds: form.apartmentIds,
    })
    await logAudit({
      buildingId: building?.id,
      userEmail: user?.email ?? '',
      userName: profile?.name ?? user?.email ?? '',
      action: editing ? 'update' : 'create',
      entity: 'user',
      entityId: email,
      after: { role: form.role, active: form.active },
    })
    setModalOpen(false)
    await load()
  }

  async function confirmDelete() {
    if (!toDelete) return
    await deleteUser(toDelete.email)
    setToDelete(null)
    await load()
  }

  return (
    <div>
      <PageHeader
        title="Χρήστες"
        subtitle="Πρόσβαση με πρόσκληση — email & ρόλος"
        actions={
          <Button onClick={openNew}>
            <Plus size={18} /> Νέος χρήστης
          </Button>
        }
      />

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs uppercase text-gray-500">
              <th className="px-3 py-2">Όνομα</th>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Ρόλος</th>
              <th className="px-3 py-2">Κατάσταση</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.email} className="border-t border-gray-100 hover:bg-gray-50">
                <td className="px-3 py-2 font-medium text-gray-900">{u.name || '—'}</td>
                <td className="px-3 py-2 text-gray-600">{u.email}</td>
                <td className="px-3 py-2">
                  <Badge color="blue">{ROLE_LABELS[u.role]}</Badge>
                </td>
                <td className="px-3 py-2">
                  <Badge color={u.active !== false ? 'green' : 'gray'}>
                    {u.active !== false ? 'Ενεργός' : 'Ανενεργός'}
                  </Badge>
                </td>
                <td className="px-3 py-2">
                  <div className="flex justify-end gap-1">
                    <button
                      onClick={() => openEdit(u)}
                      className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-blue-600"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => setToDelete(u)}
                      className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-red-600"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-gray-400">
                  Δεν υπάρχουν χρήστες ακόμη.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Επεξεργασία χρήστη' : 'Νέος χρήστης'}
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
          <Field
            label="Email ή κινητό"
            hint="Το αναγνωριστικό εισόδου: email (για Google/email-link) ή κινητό σε διεθνή μορφή (π.χ. +306941234567) για SMS OTP."
          >
            <TextField
              value={form.email}
              disabled={!!editing}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </Field>
          <Field label="Ονοματεπώνυμο">
            <TextField value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Ρόλος">
              <SelectField
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
              >
                {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </SelectField>
            </Field>
            <Field label="Κινητό (προαιρετικό)">
              <TextField value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
            />
            Ενεργός λογαριασμός
          </label>

          {(form.role === 'owner' || form.role === 'resident') && (
            <div>
              <div className="mb-1 text-sm font-medium text-gray-700">Διαμερίσματα</div>
              <div className="grid max-h-40 grid-cols-2 gap-1 overflow-y-auto rounded-md border border-gray-200 p-2 sm:grid-cols-3">
                {apartments.map((a) => (
                  <label key={a.id} className="flex items-center gap-1.5 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={form.apartmentIds.includes(a.id)}
                      onChange={() => toggleApartment(a.id)}
                    />
                    {a.code}
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        open={!!toDelete}
        message={`Διαγραφή πρόσβασης για ${toDelete?.email};`}
        onCancel={() => setToDelete(null)}
        onConfirm={confirmDelete}
      />
    </div>
  )
}
