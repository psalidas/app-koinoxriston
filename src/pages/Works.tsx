import { useEffect, useState } from 'react'
import { Plus, Trash2, Paperclip, Upload, Hammer } from 'lucide-react'
import { Timestamp } from 'firebase/firestore'
import { useAppData } from '@/lib/appData'
import { useAuth } from '@/lib/auth'
import { Button, Card, PageHeader, Field, TextField, NumberField, SelectField, Badge } from '@/components/forms'
import { Modal } from '@/components/Modal'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { UploadProgress } from '@/components/UploadProgress'
import { money, formatDate } from '@/lib/format'
import type { WorkTask, WorkStatus } from '@/types'
import { WORK_STATUS_LABELS, WORK_STATUS_ORDER, WORK_CATEGORIES } from '@/types'
import { listWorks, createWork, updateWork, deleteWork } from '@/lib/repos/works'
import { uploadDocument, deleteFile } from '@/lib/upload'
import { logAudit } from '@/lib/audit'

function toISO(ts?: Timestamp): string {
  const ms = ts?.toMillis?.()
  return ms ? new Date(ms).toISOString().slice(0, 10) : ''
}

const STATUS_COLOR: Record<WorkStatus, 'amber' | 'blue' | 'green'> = {
  todo: 'amber',
  in_progress: 'blue',
  done: 'green',
}

const blankForm = () => ({
  title: '',
  description: '',
  status: 'todo' as WorkStatus,
  category: WORK_CATEGORIES[0],
  vendor: '',
  cost: 0,
  startDate: '',
  endDate: '',
})

export default function Works() {
  const { building } = useAppData()
  const { isManager, user, profile } = useAuth()
  const [items, setItems] = useState<WorkTask[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<WorkTask | null>(null)
  const [form, setForm] = useState(blankForm())
  const [toDelete, setToDelete] = useState<WorkTask | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [uploadPct, setUploadPct] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)

  async function load() {
    if (!building) return
    setLoading(true)
    try {
      setItems(await listWorks(building.id))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [building])

  function openNew() {
    setEditing(null)
    setForm(blankForm())
    setFile(null)
    setModalOpen(true)
  }

  function openTask(w: WorkTask) {
    setEditing(w)
    setForm({
      title: w.title,
      description: w.description ?? '',
      status: w.status,
      category: w.category ?? WORK_CATEGORIES[0],
      vendor: w.vendor ?? '',
      cost: w.cost ?? 0,
      startDate: toISO(w.startDate),
      endDate: toISO(w.endDate),
    })
    setFile(null)
    setModalOpen(true)
  }

  async function save() {
    if (!building || !form.title.trim()) return
    setBusy(true)
    try {
      const data = {
        buildingId: building.id,
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        status: form.status,
        category: form.category,
        vendor: form.vendor.trim() || undefined,
        cost: Number(form.cost) || undefined,
        startDate: form.startDate ? Timestamp.fromDate(new Date(form.startDate)) : undefined,
        endDate: form.endDate ? Timestamp.fromDate(new Date(form.endDate)) : undefined,
      }
      if (editing) {
        await updateWork(editing.id, data)
      } else {
        await createWork({ ...data, createdBy: user?.email ?? undefined, createdByName: profile?.name ?? undefined })
      }
      await logAudit({
        buildingId: building.id,
        userEmail: user?.email ?? '',
        userName: profile?.name ?? user?.email ?? '',
        action: editing ? 'update' : 'create',
        entity: 'work',
        entityId: editing?.id ?? form.title.trim(),
      })
      setModalOpen(false)
      await load()
    } finally {
      setBusy(false)
    }
  }

  async function addAttachment() {
    if (!editing || !building || !file) return
    setBusy(true)
    try {
      const up = await uploadDocument(file, building.id, setUploadPct)
      const attachments = [...(editing.attachments ?? []), { url: up.url, name: up.name, path: up.path }]
      await updateWork(editing.id, { attachments })
      const fresh = { ...editing, attachments }
      setEditing(fresh)
      setItems((prev) => prev.map((w) => (w.id === fresh.id ? fresh : w)))
      setFile(null)
    } catch (e) {
      alert('Σφάλμα ανεβάσματος: ' + (e as Error).message)
    } finally {
      setBusy(false)
      setUploadPct(null)
    }
  }

  async function removeAttachment(path: string) {
    if (!editing) return
    setBusy(true)
    try {
      const attachments = (editing.attachments ?? []).filter((a) => a.path !== path)
      await updateWork(editing.id, { attachments })
      const fresh = { ...editing, attachments }
      setEditing(fresh)
      setItems((prev) => prev.map((w) => (w.id === fresh.id ? fresh : w)))
      await deleteFile(path)
    } finally {
      setBusy(false)
    }
  }

  async function confirmDelete() {
    if (!toDelete) return
    for (const a of toDelete.attachments ?? []) await deleteFile(a.path)
    await deleteWork(toDelete.id)
    setToDelete(null)
    setModalOpen(false)
    await load()
  }

  return (
    <div>
      <PageHeader
        title="Εργασίες"
        subtitle="Εργασίες πολυκατοικίας — προσφορές, κόστος & χρονοδιάγραμμα"
        actions={
          isManager && (
            <Button onClick={openNew}>
              <Plus size={18} /> Νέα εργασία
            </Button>
          )
        }
      />

      {loading ? (
        <Card>
          <p className="py-8 text-center text-sm text-gray-400">Φόρτωση…</p>
        </Card>
      ) : (
        <div className="grid gap-3 lg:grid-cols-3">
          {WORK_STATUS_ORDER.map((status) => {
            const col = items.filter((w) => w.status === status)
            return (
              <div key={status} className="rounded-lg bg-gray-100/70 p-2">
                <div className="mb-2 flex items-center justify-between px-1">
                  <h2 className="text-sm font-semibold text-gray-700">{WORK_STATUS_LABELS[status]}</h2>
                  <Badge color={STATUS_COLOR[status]}>{col.length}</Badge>
                </div>
                <div className="space-y-2">
                  {col.length === 0 && (
                    <p className="px-1 py-4 text-center text-xs text-gray-400">—</p>
                  )}
                  {col.map((w) => (
                    <button
                      key={w.id}
                      onClick={() => openTask(w)}
                      className="w-full rounded-lg border border-gray-200 bg-white p-3 text-left shadow-sm transition hover:border-blue-300"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-medium text-gray-900">{w.title}</span>
                        {w.cost ? <span className="tnum shrink-0 text-sm text-gray-700">{money(w.cost)}</span> : null}
                      </div>
                      {w.description && (
                        <p className="mt-1 line-clamp-2 text-xs text-gray-500">{w.description}</p>
                      )}
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                        {w.category && <Badge color="gray">{w.category}</Badge>}
                        {w.vendor && <span>🛠 {w.vendor}</span>}
                        {(w.startDate || w.endDate) && (
                          <span>
                            {formatDate(w.startDate)}
                            {w.endDate ? ` → ${formatDate(w.endDate)}` : ''}
                          </span>
                        )}
                        {(w.attachments?.length ?? 0) > 0 && (
                          <span className="inline-flex items-center gap-0.5">
                            <Paperclip size={12} /> {w.attachments!.length}
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? (isManager ? 'Επεξεργασία εργασίας' : editing.title) : 'Νέα εργασία'}
        wide
        footer={
          isManager ? (
            <>
              {editing && (
                <Button variant="danger" onClick={() => setToDelete(editing)} className="mr-auto">
                  <Trash2 size={16} /> Διαγραφή
                </Button>
              )}
              <Button variant="secondary" onClick={() => setModalOpen(false)}>
                Ακύρωση
              </Button>
              <Button onClick={save} disabled={busy || !form.title.trim()}>
                Αποθήκευση
              </Button>
            </>
          ) : (
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Κλείσιμο
            </Button>
          )
        }
      >
        <div className="space-y-3">
          <Field label="Τίτλος">
            <TextField
              value={form.title}
              disabled={!isManager}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </Field>
          <Field label="Περιγραφή">
            <textarea
              rows={3}
              value={form.description}
              disabled={!isManager}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50"
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Κατάσταση">
              <SelectField
                value={form.status}
                disabled={!isManager}
                onChange={(e) => setForm({ ...form, status: e.target.value as WorkStatus })}
              >
                {WORK_STATUS_ORDER.map((s) => (
                  <option key={s} value={s}>
                    {WORK_STATUS_LABELS[s]}
                  </option>
                ))}
              </SelectField>
            </Field>
            <Field label="Κατηγορία">
              <SelectField
                value={form.category}
                disabled={!isManager}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                {WORK_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </SelectField>
            </Field>
            <Field label="Ανάδοχος / Συνεργείο">
              <TextField
                value={form.vendor}
                disabled={!isManager}
                onChange={(e) => setForm({ ...form, vendor: e.target.value })}
              />
            </Field>
            <Field label="Κόστος (€)">
              <NumberField
                step="0.01"
                value={form.cost}
                disabled={!isManager}
                onChange={(e) => setForm({ ...form, cost: Number(e.target.value) })}
              />
            </Field>
            <Field label="Έναρξη">
              <TextField
                type="date"
                value={form.startDate}
                disabled={!isManager}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              />
            </Field>
            <Field label="Λήξη / παράδοση">
              <TextField
                type="date"
                value={form.endDate}
                disabled={!isManager}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
              />
            </Field>
          </div>

          {/* Attachments — only for saved tasks */}
          {editing ? (
            <div className="border-t border-gray-100 pt-3">
              <h3 className="mb-2 text-sm font-semibold text-gray-700">Προσφορές & αρχεία</h3>
              {(editing.attachments ?? []).length === 0 && (
                <p className="text-xs text-gray-400">Κανένα αρχείο.</p>
              )}
              <ul className="space-y-1">
                {(editing.attachments ?? []).map((f) => (
                  <li key={f.path} className="flex items-center gap-2">
                    <a
                      href={f.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline"
                    >
                      <Paperclip size={14} /> {f.name}
                    </a>
                    {isManager && (
                      <button
                        onClick={() => removeAttachment(f.path)}
                        disabled={busy}
                        title="Διαγραφή"
                        className="rounded p-0.5 text-gray-300 hover:bg-gray-100 hover:text-red-600 disabled:opacity-50"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
              {isManager && (
                <>
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      key={editing.attachments?.length ?? 0}
                      type="file"
                      onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                      className="block flex-1 text-sm text-gray-600 file:mr-3 file:rounded-md file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100"
                    />
                    <Button variant="secondary" onClick={addAttachment} disabled={!file || busy}>
                      <Upload size={16} /> Ανέβασμα
                    </Button>
                  </div>
                  <UploadProgress value={uploadPct} />
                </>
              )}
            </div>
          ) : (
            isManager && (
              <p className="flex items-center gap-1.5 border-t border-gray-100 pt-3 text-xs text-gray-400">
                <Hammer size={14} /> Αποθήκευσε την εργασία για να προσθέσεις προσφορές/αρχεία.
              </p>
            )
          )}
        </div>
      </Modal>

      <ConfirmDialog
        open={!!toDelete}
        message={`Διαγραφή εργασίας «${toDelete?.title}»;`}
        onCancel={() => setToDelete(null)}
        onConfirm={confirmDelete}
      />
    </div>
  )
}
