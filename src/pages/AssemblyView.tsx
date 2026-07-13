import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Pencil, Trash2, Paperclip, Upload, MapPin } from 'lucide-react'
import { Timestamp } from 'firebase/firestore'
import { useAppData } from '@/lib/appData'
import { useAuth } from '@/lib/auth'
import { Button, Card, Field, TextField, SelectField, Badge } from '@/components/forms'
import { Modal } from '@/components/Modal'
import { mille, formatDateTime } from '@/lib/format'
import type { Apartment, Assembly, AssemblyAttachment, AssemblySection } from '@/types'
import { getAssembly, updateAssembly, deleteAssembly } from '@/lib/repos/assemblies'
import { uploadReceipt, deleteFile } from '@/lib/upload'

const WEIGHT_SCALE = 'genika'
const weightOf = (apt: Apartment) => apt.millesimes[WEIGHT_SCALE] ?? 0

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
  const { building, apartments } = useAppData()
  const { isManager } = useAuth()
  const [a, setA] = useState<Assembly | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({
    title: '',
    location: '',
    scheduledAt: '',
    status: 'planned' as 'planned' | 'held',
    invitation: '',
    minutes: '',
    decisions: '',
    presentApartmentIds: [] as string[],
  })

  const sortedApartments = useMemo(
    () => [...apartments].sort((x, y) => x.orderNo - y.orderNo),
    [apartments],
  )
  const buildingWeight = useMemo(
    () => apartments.reduce((s, apt) => s + weightOf(apt), 0),
    [apartments],
  )

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
      location: a.location ?? '',
      scheduledAt: toLocal(a.scheduledAt),
      status: a.status,
      invitation: a.invitation ?? '',
      minutes: a.minutes ?? '',
      decisions: a.decisions ?? '',
      presentApartmentIds: a.presentApartmentIds ?? [],
    })
    setEditOpen(true)
  }

  async function save() {
    if (!a) return
    const presentIds = form.presentApartmentIds.filter((pid) => apartments.some((apt) => apt.id === pid))
    const presentWeight = apartments
      .filter((apt) => presentIds.includes(apt.id))
      .reduce((s, apt) => s + weightOf(apt), 0)
    await updateAssembly(a.id, {
      title: form.title.trim(),
      location: form.location.trim() || undefined,
      scheduledAt: form.scheduledAt ? Timestamp.fromDate(new Date(form.scheduledAt)) : undefined,
      status: form.status,
      invitation: form.invitation.trim() || undefined,
      minutes: form.minutes.trim() || undefined,
      decisions: form.decisions.trim() || undefined,
      presentApartmentIds: presentIds,
      presentWeight,
      totalWeight: a.totalWeight ?? buildingWeight,
    })
    setEditOpen(false)
    await load()
  }

  async function addAttachment(section: AssemblySection, file: File) {
    if (!a || !building) return
    setBusy(true)
    try {
      const up = await uploadReceipt(file, building.id)
      const attachments = [...(a.attachments ?? []), { ...up, section }]
      await updateAssembly(a.id, { attachments })
      await load()
    } finally {
      setBusy(false)
    }
  }

  async function removeAttachment(att: AssemblyAttachment) {
    if (!a) return
    setBusy(true)
    try {
      const attachments = (a.attachments ?? []).filter((x) => x.path !== att.path)
      await updateAssembly(a.id, { attachments })
      await deleteFile(att.path)
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

  const attachments = a.attachments ?? []
  const total = a.totalWeight ?? buildingWeight
  const present = a.presentWeight ?? 0
  const quorum = total ? Math.round((present / total) * 100) : 0

  const sectionProps = { attachments, isManager, onUpload: addAttachment, onRemove: removeAttachment, busy }

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
            {a.location && (
              <div className="mt-0.5 inline-flex items-center gap-1 text-sm text-gray-500">
                <MapPin size={14} /> {a.location}
              </div>
            )}
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

      <SectionCard title="Πρόσκληση / Ημερήσια διάταξη" body={a.invitation} section="invitation" {...sectionProps} />
      <SectionCard title="Πρακτικά" body={a.minutes} section="minutes" {...sectionProps} />
      <SectionCard title="Αποφάσεις" body={a.decisions} section="decisions" {...sectionProps} />
      <SectionCard title="Έγγραφα (γενικά)" section="general" {...sectionProps} />

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
            <Field label="Μέρος διεξαγωγής">
              <TextField
                placeholder="π.χ. ισόγειο πολυκατοικίας"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
              />
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
          </div>

          <PresentPicker
            apartments={sortedApartments}
            totalWeight={a.totalWeight ?? buildingWeight}
            selected={form.presentApartmentIds}
            onChange={(ids) => setForm({ ...form, presentApartmentIds: ids })}
          />

          <EditArea label="Πρόσκληση / Ημερήσια διάταξη" value={form.invitation} onChange={(v) => setForm({ ...form, invitation: v })} />
          <EditArea label="Πρακτικά" value={form.minutes} onChange={(v) => setForm({ ...form, minutes: v })} />
          <EditArea label="Αποφάσεις" value={form.decisions} onChange={(v) => setForm({ ...form, decisions: v })} />
        </div>
      </Modal>
    </div>
  )
}

function PresentPicker({
  apartments,
  totalWeight,
  selected,
  onChange,
}: {
  apartments: Apartment[]
  totalWeight: number
  selected: string[]
  onChange: (ids: string[]) => void
}) {
  const set = new Set(selected)
  const presentWeight = apartments.filter((apt) => set.has(apt.id)).reduce((s, apt) => s + weightOf(apt), 0)
  const quorum = totalWeight ? Math.round((presentWeight / totalWeight) * 100) : 0

  function toggle(aptId: string) {
    const next = new Set(set)
    if (next.has(aptId)) next.delete(aptId)
    else next.add(aptId)
    onChange([...next])
  }

  return (
    <Field label="Παρόντα διαμερίσματα (απαρτία)">
      <div className="overflow-hidden rounded-md border border-gray-300">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 bg-gray-50 px-3 py-2 text-xs">
          <div className="flex items-center gap-2">
            <button type="button" className="text-blue-600 hover:underline" onClick={() => onChange(apartments.map((apt) => apt.id))}>
              Επιλογή όλων
            </button>
            <span className="text-gray-300">·</span>
            <button type="button" className="text-blue-600 hover:underline" onClick={() => onChange([])}>
              Καθαρισμός
            </button>
          </div>
          <span className="tnum font-medium text-gray-700">
            {mille(presentWeight)} / {mille(totalWeight)} χιλ. ({quorum}%)
          </span>
        </div>
        {apartments.length === 0 ? (
          <p className="px-3 py-3 text-sm text-gray-400">Δεν υπάρχουν διαμερίσματα.</p>
        ) : (
          <ul className="max-h-56 divide-y divide-gray-100 overflow-y-auto">
            {apartments.map((apt) => (
              <li key={apt.id}>
                <label className="flex cursor-pointer items-center gap-2.5 px-3 py-1.5 text-sm hover:bg-gray-50">
                  <input
                    type="checkbox"
                    checked={set.has(apt.id)}
                    onChange={() => toggle(apt.id)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="flex-1 truncate text-gray-800">
                    {apt.code} — {apt.ownerName}
                  </span>
                  <span className="tnum text-gray-500">{mille(weightOf(apt))}</span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Field>
  )
}

function SectionCard({
  title,
  body,
  section,
  attachments,
  isManager,
  onUpload,
  onRemove,
  busy,
}: {
  title: string
  body?: string
  section: AssemblySection
  attachments: AssemblyAttachment[]
  isManager: boolean
  onUpload: (section: AssemblySection, file: File) => void | Promise<void>
  onRemove: (att: AssemblyAttachment) => void | Promise<void>
  busy: boolean
}) {
  const list = attachments.filter((x) => (x.section ?? 'general') === section)
  // Hide empty sections from non-managers (nothing to show or do).
  if (!isManager && !body && list.length === 0) return null

  return (
    <Card className="mt-4">
      <h2 className="mb-1 text-sm font-semibold text-gray-700">{title}</h2>
      {body ? (
        <p className="whitespace-pre-wrap text-sm text-gray-700">{body}</p>
      ) : (
        section !== 'general' && <p className="text-sm text-gray-400">—</p>
      )}
      <AttachmentArea section={section} list={list} isManager={isManager} onUpload={onUpload} onRemove={onRemove} busy={busy} />
    </Card>
  )
}

function AttachmentArea({
  section,
  list,
  isManager,
  onUpload,
  onRemove,
  busy,
}: {
  section: AssemblySection
  list: AssemblyAttachment[]
  isManager: boolean
  onUpload: (section: AssemblySection, file: File) => void | Promise<void>
  onRemove: (att: AssemblyAttachment) => void | Promise<void>
  busy: boolean
}) {
  const [file, setFile] = useState<File | null>(null)

  async function submit() {
    if (!file) return
    await onUpload(section, file)
    setFile(null)
  }

  if (!isManager && list.length === 0) return null

  return (
    <div className="mt-3 border-t border-gray-100 pt-3">
      {list.length === 0 && !isManager ? null : list.length === 0 ? (
        <p className="text-xs text-gray-400">Κανένα συνημμένο.</p>
      ) : (
        <ul className="space-y-1">
          {list.map((f) => (
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
                  onClick={() => onRemove(f)}
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
      )}
      {isManager && (
        <div className="mt-2 flex items-center gap-2">
          <input
            key={`${section}-${list.length}`}
            type="file"
            accept="image/*,application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block flex-1 text-sm text-gray-600 file:mr-3 file:rounded-md file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100"
          />
          <Button variant="secondary" onClick={submit} disabled={!file || busy}>
            <Upload size={16} /> Επισύναψη
          </Button>
        </div>
      )}
    </div>
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
