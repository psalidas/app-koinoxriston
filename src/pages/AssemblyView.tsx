import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Pencil, Trash2, Paperclip, Upload } from 'lucide-react'
import { Timestamp } from 'firebase/firestore'
import { useAppData } from '@/lib/appData'
import { useAuth } from '@/lib/auth'
import { Button, Card, Field, TextField, SelectField, Badge } from '@/components/forms'
import { Modal } from '@/components/Modal'
import { mille, formatDateTime } from '@/lib/format'
import type { Assembly } from '@/types'
import { getAssembly, updateAssembly, deleteAssembly } from '@/lib/repos/assemblies'
import { uploadReceipt } from '@/lib/upload'

function toLocal(ts?: Timestamp): string {
  const ms = ts?.toMillis?.()
  if (!ms) return ''
  const d = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function AssemblyView() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { building } = useAppData()
  const { isManager } = useAuth()
  const [a, setA] = useState<Assembly | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [form, setForm] = useState({
    title: '',
    scheduledAt: '',
    status: 'planned' as 'planned' | 'held',
    invitation: '',
    minutes: '',
    decisions: '',
    presentWeight: 0,
  })

  async function load() {
    if (!id) return
    setA(await getAssembly(id))
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  if (!a) return <div className="text-gray-400">Φόρτωση…</div>

  function openEdit() {
    if (!a) return
    setForm({
      title: a.title,
      scheduledAt: toLocal(a.scheduledAt),
      status: a.status,
      invitation: a.invitation ?? '',
      minutes: a.minutes ?? '',
      decisions: a.decisions ?? '',
      presentWeight: a.presentWeight ?? 0,
    })
    setEditOpen(true)
  }

  async function save() {
    if (!a) return
    await updateAssembly(a.id, {
      title: form.title.trim(),
      scheduledAt: form.scheduledAt ? Timestamp.fromDate(new Date(form.scheduledAt)) : undefined,
      status: form.status,
      invitation: form.invitation.trim() || undefined,
      minutes: form.minutes.trim() || undefined,
      decisions: form.decisions.trim() || undefined,
      presentWeight: Number(form.presentWeight) || undefined,
    })
    setEditOpen(false)
    await load()
  }

  async function addAttachment() {
    if (!a || !building || !file) return
    setBusy(true)
    try {
      const up = await uploadReceipt(file, building.id)
      const attachments = [...(a.attachments ?? []), { url: up.url, name: up.name, path: up.path }]
      await updateAssembly(a.id, { attachments })
      setFile(null)
      await load()
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (!a) return
    await deleteAssembly(a.id)
    navigate('/assemblies')
  }

  const total = a.totalWeight ?? 0
  const present = a.presentWeight ?? 0
  const quorum = total ? Math.round((present / total) * 100) : 0

  return (
    <div className="mx-auto max-w-3xl">
      <button
        onClick={() => navigate('/assemblies')}
        className="mb-3 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft size={16} /> Συνελεύσεις
      </button>

      <Card>
        <div className="flex items-start justify-between gap-2">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">{a.title}</h1>
            <div className="mt-0.5 text-sm text-gray-500">{formatDateTime(a.scheduledAt)}</div>
          </div>
          <div className="flex items-center gap-2">
            <Badge color={a.status === 'held' ? 'green' : 'amber'}>
              {a.status === 'held' ? 'Πραγματοποιήθηκε' : 'Προγραμματισμένη'}
            </Badge>
            {isManager && (
              <>
                <button onClick={openEdit} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-blue-600">
                  <Pencil size={16} />
                </button>
                <button onClick={remove} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-red-600">
                  <Trash2 size={16} />
                </button>
              </>
            )}
          </div>
        </div>

        {total > 0 && (
          <div className="mt-3 rounded-md bg-gray-50 p-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Απαρτία (χιλιοστά)</span>
              <span className="tnum font-medium">
                {mille(present)} / {mille(total)} ({quorum}%)
              </span>
            </div>
            <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-gray-200">
              <div
                className={`h-full rounded-full ${quorum >= 50 ? 'bg-green-500' : 'bg-amber-500'}`}
                style={{ width: `${Math.min(quorum, 100)}%` }}
              />
            </div>
          </div>
        )}
      </Card>

      <Section title="Πρόσκληση / Ημερήσια διάταξη" body={a.invitation} />
      <Section title="Πρακτικά" body={a.minutes} />
      <Section title="Αποφάσεις" body={a.decisions} />

      {/* Attachments */}
      <Card className="mt-4">
        <h2 className="mb-2 text-sm font-semibold text-gray-700">Έγγραφα</h2>
        {(a.attachments ?? []).length === 0 && <p className="text-sm text-gray-400">Κανένα έγγραφο.</p>}
        <ul className="space-y-1">
          {(a.attachments ?? []).map((f, i) => (
            <li key={i}>
              <a
                href={f.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline"
              >
                <Paperclip size={14} /> {f.name}
              </a>
            </li>
          ))}
        </ul>
        {isManager && (
          <div className="mt-3 flex items-center gap-2">
            <input
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block flex-1 text-sm text-gray-600 file:mr-3 file:rounded-md file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100"
            />
            <Button onClick={addAttachment} disabled={!file || busy}>
              <Upload size={16} /> Ανέβασμα
            </Button>
          </div>
        )}
      </Card>

      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Επεξεργασία συνέλευσης"
        wide
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditOpen(false)}>
              Ακύρωση
            </Button>
            <Button onClick={save}>Αποθήκευση</Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Τίτλος">
              <TextField value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </Field>
            <Field label="Ημερομηνία">
              <TextField
                type="datetime-local"
                value={form.scheduledAt}
                onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })}
              />
            </Field>
            <Field label="Κατάσταση">
              <SelectField
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as 'planned' | 'held' })}
              >
                <option value="planned">Προγραμματισμένη</option>
                <option value="held">Πραγματοποιήθηκε</option>
              </SelectField>
            </Field>
            <Field label="Παρόντα χιλιοστά (απαρτία)">
              <TextField
                type="number"
                value={form.presentWeight}
                onChange={(e) => setForm({ ...form, presentWeight: Number(e.target.value) })}
              />
            </Field>
          </div>
          <EditArea label="Πρόσκληση / Ημερήσια διάταξη" value={form.invitation} onChange={(v) => setForm({ ...form, invitation: v })} />
          <EditArea label="Πρακτικά" value={form.minutes} onChange={(v) => setForm({ ...form, minutes: v })} />
          <EditArea label="Αποφάσεις" value={form.decisions} onChange={(v) => setForm({ ...form, decisions: v })} />
        </div>
      </Modal>
    </div>
  )
}

function Section({ title, body }: { title: string; body?: string }) {
  if (!body) return null
  return (
    <Card className="mt-4">
      <h2 className="mb-1 text-sm font-semibold text-gray-700">{title}</h2>
      <p className="whitespace-pre-wrap text-sm text-gray-700">{body}</p>
    </Card>
  )
}

function EditArea({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <Field label={label}>
      <textarea
        rows={4}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
    </Field>
  )
}
