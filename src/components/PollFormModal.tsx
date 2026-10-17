import { useEffect, useState } from 'react'
import { Plus, X, Upload } from 'lucide-react'
import { Timestamp } from 'firebase/firestore'
import { Button, Field, TextField, SelectField } from '@/components/forms'
import { Modal } from '@/components/Modal'
import type { Apartment, Building, Poll, PollEligibility, PollWeightMode, AnnouncementAttachment } from '@/types'
import { POLL_WEIGHT_LABELS } from '@/types'
import { createPoll, updatePoll, totalEligibleWeight } from '@/lib/repos/polls'
import { uploadDocument } from '@/lib/upload'

function toISO(ts?: Timestamp): string {
  const d = ts?.toDate?.()
  return d ? d.toISOString().slice(0, 10) : ''
}

/** Κοινή φόρμα δημιουργίας & επεξεργασίας ψηφοφορίας (με πρόχειρο & συνημμένα). */
export function PollFormModal({
  open,
  onClose,
  building,
  apartments,
  poll,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  building: Building
  apartments: Apartment[]
  poll?: Poll | null
  onSaved: () => void
}) {
  const scales = building.scales ?? []
  const editing = !!poll
  const [question, setQuestion] = useState('')
  const [description, setDescription] = useState('')
  const [options, setOptions] = useState<string[]>(['Ναι', 'Όχι'])
  const [eligibility, setEligibility] = useState<PollEligibility>('owners')
  const [weightMode, setWeightMode] = useState<PollWeightMode>('millesime')
  const [scaleKey, setScaleKey] = useState('genika')
  const [deadline, setDeadline] = useState('')
  const [isDraft, setIsDraft] = useState(true)
  const [attachments, setAttachments] = useState<AnnouncementAttachment[]>([])
  const [newFiles, setNewFiles] = useState<File[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    if (poll) {
      setQuestion(poll.question)
      setDescription(poll.description ?? '')
      setOptions(poll.options.length ? poll.options : ['Ναι', 'Όχι'])
      setEligibility(poll.eligibility)
      setWeightMode(poll.weightMode)
      setScaleKey(poll.scaleKey ?? scales[0]?.key ?? 'genika')
      setDeadline(toISO(poll.deadline))
      setIsDraft(poll.status === 'draft')
      setAttachments(poll.attachments ?? [])
    } else {
      setQuestion('')
      setDescription('')
      setOptions(['Ναι', 'Όχι'])
      setEligibility('owners')
      setWeightMode('millesime')
      setScaleKey(scales[0]?.key ?? 'genika')
      setDeadline('')
      setIsDraft(true)
      setAttachments([])
    }
    setNewFiles([])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, poll])

  async function save() {
    if (saving) return
    const opts = options.map((o) => o.trim()).filter(Boolean)
    if (!question.trim() || opts.length < 2) {
      alert('Χρειάζονται ερώτηση και τουλάχιστον 2 επιλογές.')
      return
    }
    setSaving(true)
    try {
      const uploaded: AnnouncementAttachment[] = []
      for (const f of newFiles) {
        const up = await uploadDocument(f, building.id)
        uploaded.push({ url: up.url, name: up.name, path: up.path, contentType: f.type || '' })
      }
      const allAttachments = [...attachments, ...uploaded]
      const totalWeight = totalEligibleWeight(apartments, weightMode, scaleKey)
      // Κατάσταση: closed μένει closed· αλλιώς draft/open βάσει checkbox.
      const status: Poll['status'] =
        poll?.status === 'closed' ? 'closed' : isDraft ? 'draft' : 'open'
      const base = {
        buildingId: building.id,
        question: question.trim(),
        description: description.trim() || undefined,
        options: opts,
        eligibility,
        weightMode,
        scaleKey: weightMode === 'millesime' ? scaleKey : undefined,
        deadline: deadline ? Timestamp.fromDate(new Date(deadline)) : undefined,
        status,
        totalWeight,
        attachments: allAttachments.length ? allAttachments : undefined,
      }
      if (poll) {
        await updatePoll(poll.id, base)
      } else {
        await createPoll(base)
      }
      onSaved()
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const hasVotes = !!poll?.results
  const saveLabel = editing ? 'Αποθήκευση' : isDraft ? 'Αποθήκευση πρόχειρου' : 'Δημιουργία'

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Επεξεργασία ψηφοφορίας' : 'Νέα ψηφοφορία'}
      wide
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Ακύρωση</Button>
          <Button onClick={save} disabled={saving}>{saving ? 'Αποθήκευση…' : saveLabel}</Button>
        </>
      }
    >
      <div className="space-y-3">
        {editing && poll?.status !== 'draft' && (
          <div className="rounded-md bg-amber-50 p-2 text-xs text-amber-700">
            Η ψηφοφορία είναι {poll?.status === 'open' ? 'ανοιχτή' : 'κλειστή'}. Αλλαγές στις επιλογές ή
            στη βαρύτητα μπορεί να επηρεάσουν ήδη καταχωρημένες ψήφους{hasVotes ? ' (υπάρχουν ψήφοι)' : ''}.
          </div>
        )}
        <Field label="Ερώτηση">
          <TextField value={question} onChange={(e) => setQuestion(e.target.value)} />
        </Field>
        <Field label="Περιγραφή (προαιρετικό)">
          <TextField value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>

        <div>
          <div className="mb-1 text-sm font-medium text-gray-700">Επιλογές</div>
          <div className="space-y-2">
            {options.map((o, i) => (
              <div key={i} className="flex items-center gap-2">
                <TextField
                  value={o}
                  onChange={(e) => setOptions((prev) => prev.map((x, idx) => (idx === i ? e.target.value : x)))}
                  className="flex-1"
                />
                {options.length > 2 && (
                  <button
                    onClick={() => setOptions((prev) => prev.filter((_, idx) => idx !== i))}
                    className="rounded p-2 text-gray-400 hover:bg-gray-100 hover:text-red-600"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            ))}
            <Button variant="ghost" onClick={() => setOptions((prev) => [...prev, ''])}>
              <Plus size={16} /> Επιλογή
            </Button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Δικαίωμα ψήφου">
            <SelectField value={eligibility} onChange={(e) => setEligibility(e.target.value as PollEligibility)}>
              <option value="owners">Ιδιοκτήτες</option>
              <option value="residents">Όλοι οι ένοικοι</option>
            </SelectField>
          </Field>
          <Field label="Βαρύτητα ψήφου">
            <SelectField value={weightMode} onChange={(e) => setWeightMode(e.target.value as PollWeightMode)}>
              {(Object.keys(POLL_WEIGHT_LABELS) as PollWeightMode[]).map((m) => (
                <option key={m} value={m}>{POLL_WEIGHT_LABELS[m]}</option>
              ))}
            </SelectField>
          </Field>
          {weightMode === 'millesime' && (
            <Field label="Πίνακας χιλιοστών">
              <SelectField value={scaleKey} onChange={(e) => setScaleKey(e.target.value)}>
                {scales.map((s) => (
                  <option key={s.key} value={s.key}>{s.label}</option>
                ))}
              </SelectField>
            </Field>
          )}
          <Field label="Προθεσμία (προαιρετικό)">
            <TextField type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          </Field>
        </div>

        <Field label="Επισυναπτόμενα (φωτογραφίες & έγγραφα)">
          <div className="space-y-2">
            {(attachments.length > 0 || newFiles.length > 0) && (
              <ul className="space-y-1">
                {attachments.map((f, i) => (
                  <li key={`a${i}`} className="flex items-center gap-2 rounded-md border border-gray-200 px-2 py-1 text-sm">
                    <a href={f.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-blue-600 hover:underline">{f.name}</a>
                    <button onClick={() => setAttachments((prev) => prev.filter((_, idx) => idx !== i))} className="shrink-0 rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-red-600"><X size={14} /></button>
                  </li>
                ))}
                {newFiles.map((f, i) => (
                  <li key={`n${i}`} className="flex items-center gap-2 rounded-md border border-dashed border-gray-300 px-2 py-1 text-sm">
                    <Upload size={14} className="shrink-0 text-blue-400" />
                    <span className="min-w-0 flex-1 truncate text-gray-700">{f.name}</span>
                    <span className="shrink-0 text-xs text-gray-400">νέο</span>
                    <button onClick={() => setNewFiles((prev) => prev.filter((_, idx) => idx !== i))} className="shrink-0 rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-red-600"><X size={14} /></button>
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

        {poll?.status !== 'closed' && (
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={isDraft} onChange={(e) => setIsDraft(e.target.checked)} />
            Πρόχειρο (δοκιμή) — δεν είναι ορατό στους ενοίκους μέχρι τη δημοσίευση
          </label>
        )}
      </div>
    </Modal>
  )
}
