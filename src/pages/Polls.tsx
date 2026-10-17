import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Vote as VoteIcon, X, ChevronRight, Upload } from 'lucide-react'
import { Timestamp } from 'firebase/firestore'
import { useAppData } from '@/lib/appData'
import { useAuth } from '@/lib/auth'
import { Button, Card, PageHeader, Field, TextField, SelectField, Badge } from '@/components/forms'
import { Modal } from '@/components/Modal'
import { formatDate } from '@/lib/format'
import type { Poll, PollEligibility, PollWeightMode, AnnouncementAttachment } from '@/types'
import { POLL_WEIGHT_LABELS } from '@/types'
import { listPolls, createPoll, totalEligibleWeight } from '@/lib/repos/polls'
import { uploadDocument } from '@/lib/upload'

export default function Polls() {
  const { building, apartments } = useAppData()
  const { isManager } = useAuth()
  const [items, setItems] = useState<Poll[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const scales = building?.scales ?? []
  const [form, setForm] = useState({
    question: '',
    description: '',
    options: ['Ναι', 'Όχι'],
    eligibility: 'owners' as PollEligibility,
    weightMode: 'millesime' as PollWeightMode,
    scaleKey: 'genika',
    deadline: '',
  })
  const [newFiles, setNewFiles] = useState<File[]>([])
  const [saving, setSaving] = useState(false)

  async function load() {
    if (!building) return
    setItems(await listPolls(building.id))
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [building])

  function openNew() {
    setForm({
      question: '',
      description: '',
      options: ['Ναι', 'Όχι'],
      eligibility: 'owners',
      weightMode: 'millesime',
      scaleKey: 'genika',
      deadline: '',
    })
    setNewFiles([])
    setModalOpen(true)
  }

  function setOption(i: number, v: string) {
    setForm((f) => ({ ...f, options: f.options.map((o, idx) => (idx === i ? v : o)) }))
  }
  function addOption() {
    setForm((f) => ({ ...f, options: [...f.options, ''] }))
  }
  function removeOption(i: number) {
    setForm((f) => ({ ...f, options: f.options.filter((_, idx) => idx !== i) }))
  }

  async function save() {
    if (!building || saving) return
    const options = form.options.map((o) => o.trim()).filter(Boolean)
    if (!form.question.trim() || options.length < 2) {
      alert('Χρειάζονται ερώτηση και τουλάχιστον 2 επιλογές.')
      return
    }
    setSaving(true)
    try {
      const attachments: AnnouncementAttachment[] = []
      for (const f of newFiles) {
        const up = await uploadDocument(f, building.id)
        attachments.push({ url: up.url, name: up.name, path: up.path, contentType: f.type || '' })
      }
      const totalWeight = totalEligibleWeight(apartments, form.weightMode, form.scaleKey)
      await createPoll({
        buildingId: building.id,
        question: form.question.trim(),
        description: form.description.trim() || undefined,
        options,
        eligibility: form.eligibility,
        weightMode: form.weightMode,
        scaleKey: form.weightMode === 'millesime' ? form.scaleKey : undefined,
        deadline: form.deadline ? Timestamp.fromDate(new Date(form.deadline)) : undefined,
        status: 'open',
        totalWeight,
        attachments: attachments.length ? attachments : undefined,
      })
      setModalOpen(false)
      await load()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Ψηφοφορίες"
        subtitle="Ηλεκτρονικές ψηφοφορίες με βάρος κατά χιλιοστά"
        actions={
          isManager && (
            <Button onClick={openNew}>
              <Plus size={18} /> Νέα ψηφοφορία
            </Button>
          )
        }
      />

      {items.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center gap-2 py-8 text-center text-gray-400">
            <VoteIcon size={28} />
            <p className="text-sm">Καμία ψηφοφορία.</p>
          </div>
        </Card>
      ) : (
        <Card className="p-0">
          <ul className="divide-y divide-gray-100">
            {items.map((p) => (
              <li key={p.id}>
                <Link to={`/polls/${p.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-gray-900">{p.question}</div>
                    <div className="text-xs text-gray-500">
                      {POLL_WEIGHT_LABELS[p.weightMode]}
                      {p.deadline && ` · λήξη ${formatDate(p.deadline)}`}
                    </div>
                  </div>
                  <Badge color={p.status === 'open' ? 'green' : 'gray'}>
                    {p.status === 'open' ? 'Ανοιχτή' : 'Κλειστή'}
                  </Badge>
                  <ChevronRight className="text-gray-300" size={18} />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Νέα ψηφοφορία"
        wide
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)} disabled={saving}>
              Ακύρωση
            </Button>
            <Button onClick={save} disabled={saving}>{saving ? 'Δημιουργία…' : 'Δημιουργία'}</Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Ερώτηση">
            <TextField value={form.question} onChange={(e) => setForm({ ...form, question: e.target.value })} />
          </Field>
          <Field label="Περιγραφή (προαιρετικό)">
            <TextField value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </Field>

          <div>
            <div className="mb-1 text-sm font-medium text-gray-700">Επιλογές</div>
            <div className="space-y-2">
              {form.options.map((o, i) => (
                <div key={i} className="flex items-center gap-2">
                  <TextField value={o} onChange={(e) => setOption(i, e.target.value)} className="flex-1" />
                  {form.options.length > 2 && (
                    <button onClick={() => removeOption(i)} className="rounded p-2 text-gray-400 hover:bg-gray-100 hover:text-red-600">
                      <X size={16} />
                    </button>
                  )}
                </div>
              ))}
              <Button variant="ghost" onClick={addOption}>
                <Plus size={16} /> Επιλογή
              </Button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Δικαίωμα ψήφου">
              <SelectField
                value={form.eligibility}
                onChange={(e) => setForm({ ...form, eligibility: e.target.value as PollEligibility })}
              >
                <option value="owners">Ιδιοκτήτες</option>
                <option value="residents">Όλοι οι ένοικοι</option>
              </SelectField>
            </Field>
            <Field label="Βαρύτητα ψήφου">
              <SelectField
                value={form.weightMode}
                onChange={(e) => setForm({ ...form, weightMode: e.target.value as PollWeightMode })}
              >
                {(Object.keys(POLL_WEIGHT_LABELS) as PollWeightMode[]).map((m) => (
                  <option key={m} value={m}>
                    {POLL_WEIGHT_LABELS[m]}
                  </option>
                ))}
              </SelectField>
            </Field>
            {form.weightMode === 'millesime' && (
              <Field label="Πίνακας χιλιοστών">
                <SelectField value={form.scaleKey} onChange={(e) => setForm({ ...form, scaleKey: e.target.value })}>
                  {scales.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.label}
                    </option>
                  ))}
                </SelectField>
              </Field>
            )}
            <Field label="Προθεσμία (προαιρετικό)">
              <TextField type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
            </Field>
          </div>

          <Field label="Επισυναπτόμενα (φωτογραφίες & έγγραφα)">
            <div className="space-y-2">
              {newFiles.length > 0 && (
                <ul className="space-y-1">
                  {newFiles.map((f, i) => (
                    <li key={i} className="flex items-center gap-2 rounded-md border border-dashed border-gray-300 px-2 py-1 text-sm">
                      <Upload size={14} className="shrink-0 text-blue-400" />
                      <span className="min-w-0 flex-1 truncate text-gray-700">{f.name}</span>
                      <button
                        onClick={() => setNewFiles((prev) => prev.filter((_, idx) => idx !== i))}
                        className="shrink-0 rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-red-600"
                        title="Αφαίρεση"
                      >
                        <X size={14} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">
                <input
                  type="file"
                  multiple
                  accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx"
                  className="hidden"
                  onChange={(e) => {
                    const fs = Array.from(e.target.files ?? [])
                    if (fs.length) setNewFiles((prev) => [...prev, ...fs])
                    e.target.value = ''
                  }}
                />
                <Plus size={16} /> Προσθήκη αρχείων
              </label>
            </div>
          </Field>
        </div>
      </Modal>
    </div>
  )
}
