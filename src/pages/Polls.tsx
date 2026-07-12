import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Vote as VoteIcon, X, ChevronRight } from 'lucide-react'
import { Timestamp } from 'firebase/firestore'
import { useAppData } from '@/lib/appData'
import { useAuth } from '@/lib/auth'
import { Button, Card, PageHeader, Field, TextField, SelectField, Badge } from '@/components/forms'
import { Modal } from '@/components/Modal'
import { formatDate } from '@/lib/format'
import type { Poll, PollEligibility, PollWeightMode } from '@/types'
import { POLL_WEIGHT_LABELS } from '@/types'
import { listPolls, createPoll, totalEligibleWeight } from '@/lib/repos/polls'

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

  async function load() {
    if (!building) return
    setItems(await listPolls(building.id))
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [building])

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
    if (!building) return
    const options = form.options.map((o) => o.trim()).filter(Boolean)
    if (!form.question.trim() || options.length < 2) {
      alert('Χρειάζονται ερώτηση και τουλάχιστον 2 επιλογές.')
      return
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
    })
    setModalOpen(false)
    await load()
  }

  return (
    <div>
      <PageHeader
        title="Ψηφοφορίες"
        subtitle="Ηλεκτρονικές ψηφοφορίες με βάρος κατά χιλιοστά"
        actions={
          isManager && (
            <Button onClick={() => setModalOpen(true)}>
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
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Ακύρωση
            </Button>
            <Button onClick={save}>Δημιουργία</Button>
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
        </div>
      </Modal>
    </div>
  )
}
