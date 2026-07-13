import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useAppData } from '@/lib/appData'
import { useAuth } from '@/lib/auth'
import { Button, Card, PageHeader, Field, TextField, SelectField, Badge } from '@/components/forms'
import { Modal } from '@/components/Modal'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { formatDate } from '@/lib/format'
import type { Ticket, TicketStatus } from '@/types'
import { TICKET_CATEGORIES, TICKET_STATUS_LABELS } from '@/types'
import { listTickets, createTicket, updateTicket, deleteTicket } from '@/lib/repos/tickets'
import { uploadReceipt } from '@/lib/upload'
import { UploadProgress } from '@/components/UploadProgress'

const STATUS_COLOR: Record<TicketStatus, 'amber' | 'blue' | 'green'> = {
  open: 'amber',
  in_progress: 'blue',
  done: 'green',
}

export default function Tickets() {
  const { building, apartments } = useAppData()
  const { isManager, user, profile } = useAuth()
  const [items, setItems] = useState<Ticket[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [uploadPct, setUploadPct] = useState<number | null>(null)
  const [toDelete, setToDelete] = useState<Ticket | null>(null)
  const myApartmentIds = profile?.apartmentIds ?? []
  const [form, setForm] = useState({
    title: '',
    category: TICKET_CATEGORIES[0] as string,
    description: '',
    apartmentId: '',
  })

  async function load() {
    if (!building) return
    setItems(await listTickets(building.id))
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [building])

  function openNew() {
    setFile(null)
    setForm({
      title: '',
      category: TICKET_CATEGORIES[0],
      description: '',
      apartmentId: myApartmentIds[0] ?? '',
    })
    setModalOpen(true)
  }

  async function save() {
    if (!building) return
    setBusy(true)
    try {
      let photo: { photoUrl?: string; photoPath?: string } = {}
      if (file) {
        setUploadPct(0)
        const up = await uploadReceipt(file, building.id, (p) => setUploadPct(p))
        photo = { photoUrl: up.url, photoPath: up.path }
      }
      const apt = apartments.find((a) => a.id === form.apartmentId)
      await createTicket({
        buildingId: building.id,
        apartmentId: form.apartmentId || undefined,
        apartmentCode: apt?.code,
        title: form.title.trim(),
        description: form.description.trim(),
        category: form.category,
        status: 'open',
        createdBy: user?.email ?? undefined,
        createdByName: profile?.name ?? user?.email ?? undefined,
        ...photo,
      })
      setModalOpen(false)
      await load()
    } catch (err) {
      alert((err as Error).message)
    } finally {
      setBusy(false)
      setUploadPct(null)
    }
  }

  async function changeStatus(t: Ticket, status: TicketStatus) {
    await updateTicket(t.id, { status })
    await load()
  }

  async function confirmDelete() {
    if (!toDelete) return
    await deleteTicket(toDelete.id)
    setToDelete(null)
    await load()
  }

  return (
    <div>
      <PageHeader
        title="Βλάβες / Αιτήματα"
        actions={
          <Button onClick={openNew}>
            <Plus size={18} /> Νέο αίτημα
          </Button>
        }
      />

      {items.length === 0 ? (
        <Card>
          <p className="py-8 text-center text-sm text-gray-400">Δεν υπάρχουν αιτήματα.</p>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {items.map((t) => (
            <Card key={t.id}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-medium text-gray-900">{t.title}</h3>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-gray-500">
                    <Badge>{t.category}</Badge>
                    {t.apartmentCode && <span>Διαμ. {t.apartmentCode}</span>}
                  </div>
                </div>
                <Badge color={STATUS_COLOR[t.status]}>{TICKET_STATUS_LABELS[t.status]}</Badge>
              </div>
              {t.description && <p className="mt-2 whitespace-pre-wrap text-sm text-gray-600">{t.description}</p>}
              {t.photoUrl && (
                <a href={t.photoUrl} target="_blank" rel="noreferrer">
                  <img src={t.photoUrl} alt="" className="mt-2 h-32 w-full rounded-md object-cover" />
                </a>
              )}
              <div className="mt-2 flex items-center justify-between">
                <span className="text-xs text-gray-400">
                  {t.createdByName} · {formatDate(t.createdAt)}
                </span>
                {isManager && (
                  <div className="flex items-center gap-1">
                    <SelectField
                      value={t.status}
                      onChange={(e) => changeStatus(t, e.target.value as TicketStatus)}
                      className="py-1 text-xs"
                    >
                      {(Object.keys(TICKET_STATUS_LABELS) as TicketStatus[]).map((s) => (
                        <option key={s} value={s}>
                          {TICKET_STATUS_LABELS[s]}
                        </option>
                      ))}
                    </SelectField>
                    <button
                      onClick={() => setToDelete(t)}
                      className="rounded p-1 text-gray-300 hover:bg-gray-100 hover:text-red-600"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Νέο αίτημα / βλάβη"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Ακύρωση
            </Button>
            <Button onClick={save} disabled={busy}>
              {busy ? 'Αποθήκευση…' : 'Υποβολή'}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Τίτλος">
            <TextField
              placeholder="π.χ. Δεν λειτουργεί το ασανσέρ"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Κατηγορία">
              <SelectField
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                {TICKET_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </SelectField>
            </Field>
            <Field label="Διαμέρισμα (προαιρετικό)">
              <SelectField
                value={form.apartmentId}
                onChange={(e) => setForm({ ...form, apartmentId: e.target.value })}
              >
                <option value="">—</option>
                {(isManager ? apartments : apartments.filter((a) => myApartmentIds.includes(a.id))).map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code}
                  </option>
                ))}
              </SelectField>
            </Field>
          </div>
          <Field label="Περιγραφή">
            <textarea
              rows={4}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </Field>
          <Field label="Φωτογραφία (προαιρετικό)">
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-md file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100"
            />
            <UploadProgress value={uploadPct} />
          </Field>
        </div>
      </Modal>

      {isManager && (
        <ConfirmDialog
          open={!!toDelete}
          message="Διαγραφή αιτήματος;"
          onCancel={() => setToDelete(null)}
          onConfirm={confirmDelete}
        />
      )}
    </div>
  )
}
