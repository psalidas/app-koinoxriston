import { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2, Pencil, Sparkles, Paperclip, ArrowUpDown } from 'lucide-react'
import { useAppData } from '@/lib/appData'
import { useAuth } from '@/lib/auth'
import { Button, Card, PageHeader, Field, TextField, NumberField, SelectField, Badge } from '@/components/forms'
import { Modal } from '@/components/Modal'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { money, currentPeriod, formatDate } from '@/lib/format'
import type { AllocationMethod, Expense, ExpenseChargeType, ExpenseGroup } from '@/types'
import { ALLOCATION_LABELS, GROUP_LABELS, GROUP_ORDER } from '@/types'
import { listExpenses, createExpense, updateExpense, deleteExpense } from '@/lib/repos/expenses'
import { uploadReceipt } from '@/lib/upload'
import { analyzeReceipt } from '@/lib/ocr'
import { UploadProgress } from '@/components/UploadProgress'
import { logAudit } from '@/lib/audit'

type FormState = {
  period: string // YYYY-MM (μήνας δαπάνης)
  date: string // YYYY-MM-DD (ημ/νία παραστατικού, προαιρετικό)
  chargeType: ExpenseChargeType
  group: ExpenseGroup
  category: string
  amount: number
  method: AllocationMethod
  scaleKey: string
  participantIds: string[] // διαμερίσματα που συμμετέχουν
  note: string
  receiptUrl?: string
  receiptName?: string
  receiptPath?: string
}

type ViewMode = 'month' | 'quarter' | 'year' | 'range'
type SortKey = 'code' | 'date' | 'category' | 'amount'

const thisYear = () => currentPeriod().slice(0, 4)
const displayDate = (e: Expense): string =>
  e.date ? new Date(e.date).toLocaleDateString('el-GR') : formatDate(e.createdAt)
const dateKey = (e: Expense): string => e.date || (e.period ? `${e.period}-15` : '0000-00-00')

function quarterMonths(year: string, q: number): string[] {
  const start = (q - 1) * 3 + 1
  return [0, 1, 2].map((i) => `${year}-${String(start + i).padStart(2, '0')}`)
}

export default function Expenses() {
  const { building, apartments, refresh } = useAppData()
  const sortedApartments = useMemo(
    () => [...apartments].sort((a, b) => a.orderNo - b.orderNo),
    [apartments],
  )
  const { isManager, user, profile } = useAuth()
  const scales = building?.scales ?? []
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(false)

  // Φίλτρα προβολής
  const [view, setView] = useState<ViewMode>('month')
  const [month, setMonth] = useState(currentPeriod())
  const [year, setYear] = useState(thisYear())
  const [quarter, setQuarter] = useState(Math.floor((new Date().getMonth()) / 3) + 1)
  const [rangeFrom, setRangeFrom] = useState(currentPeriod())
  const [rangeTo, setRangeTo] = useState(currentPeriod())
  const [sortKey, setSortKey] = useState<SortKey>('date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Expense | null>(null)
  const [toDelete, setToDelete] = useState<Expense | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadPct, setUploadPct] = useState<number | null>(null)
  const [aiBusy, setAiBusy] = useState(false)
  const [aiMsg, setAiMsg] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(blankForm(scales[0]?.key))

  function blankForm(scaleKey?: string): FormState {
    return {
      period: currentPeriod(),
      date: '',
      chargeType: 'period',
      group: 'koinoxrista',
      category: '',
      amount: 0,
      method: 'millesime',
      scaleKey: scaleKey ?? 'genika',
      participantIds: apartments.map((a) => a.id),
      note: '',
    }
  }

  async function load() {
    if (!building) return
    setLoading(true)
    try {
      setExpenses(await listExpenses(building.id))
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
    setFile(null)
    setAiMsg(null)
    setForm(blankForm(scales[0]?.key))
    setModalOpen(true)
  }

  function openEdit(e: Expense) {
    setEditing(e)
    setFile(null)
    setAiMsg(null)
    setForm({
      period: e.period,
      date: e.date ?? '',
      chargeType: e.chargeType ?? 'period',
      group: e.group,
      category: e.category,
      amount: e.amount,
      method: e.method,
      scaleKey: e.scaleKey ?? scales[0]?.key ?? 'genika',
      participantIds:
        Array.isArray(e.participantApartmentIds) && e.participantApartmentIds.length > 0
          ? e.participantApartmentIds
          : apartments.map((a) => a.id),
      note: e.note ?? '',
      receiptUrl: e.receiptUrl,
      receiptName: e.receiptName,
      receiptPath: e.receiptPath,
    })
    setModalOpen(true)
  }

  async function analyze() {
    if (!file) return
    setAiBusy(true)
    setAiMsg(null)
    try {
      const res = await analyzeReceipt(file)
      setForm((f) => ({
        ...f,
        amount: res.amount ?? f.amount,
        category: res.category || res.merchant || f.category,
        date: res.date || f.date,
        period: res.date ? res.date.slice(0, 7) : f.period,
        note: f.note || res.merchant || '',
      }))
      const got = [
        res.amount != null ? 'ποσό' : null,
        res.category ? 'κατηγορία' : null,
        res.date ? 'ημ/νία' : null,
        res.merchant ? 'προμηθευτής' : null,
      ].filter(Boolean)
      setAiMsg(
        got.length
          ? `Συμπληρώθηκαν: ${got.join(', ')}. Έλεγξε & διόρθωσε αν χρειάζεται.`
          : 'Δεν αναγνωρίστηκαν πεδία από το παραστατικό.',
      )
    } catch (e) {
      setAiMsg('Αποτυχία ανάλυσης: ' + (e as Error).message)
    } finally {
      setAiBusy(false)
    }
  }

  async function save() {
    if (!building) return
    if (sortedApartments.length > 0 && form.participantIds.length === 0) {
      alert('Επίλεξε τουλάχιστον ένα συμμετέχον διαμέρισμα.')
      return
    }
    setUploading(true)
    let receipt = {
      receiptUrl: form.receiptUrl,
      receiptName: form.receiptName,
      receiptPath: form.receiptPath,
    }
    try {
      if (file) {
        setUploadPct(0)
        const up = await uploadReceipt(file, building.id, (p) => setUploadPct(p))
        receipt = { receiptUrl: up.url, receiptName: up.name, receiptPath: up.path }
      }
    } catch (err) {
      alert('Σφάλμα ανεβάσματος: ' + (err as Error).message)
      setUploading(false)
      setUploadPct(null)
      return
    }
    setUploadPct(null)
    const data = {
      buildingId: building.id,
      period: form.period,
      date: form.date || undefined,
      chargeType: form.chargeType,
      group: form.group,
      category: form.category.trim(),
      amount: Number(form.amount) || 0,
      method: form.method,
      scaleKey: form.method === 'millesime' || form.method === 'heating' ? form.scaleKey : undefined,
      // Αν συμμετέχουν όλα → null (καθαρίζει τυχόν παλιό υποσύνολο σε επεξεργασία·
      // σημαίνει «όλα»). Αλλιώς αποθηκεύουμε το υποσύνολο.
      participantApartmentIds:
        apartments.length > 0 && apartments.every((a) => form.participantIds.includes(a.id))
          ? null
          : form.participantIds,
      note: form.note.trim() || undefined,
      ...receipt,
    }
    if (editing) await updateExpense(editing.id, data)
    else await createExpense(data)
    setUploading(false)
    await logAudit({
      buildingId: building.id,
      userEmail: user?.email ?? '',
      userName: profile?.name ?? user?.email ?? '',
      action: editing ? 'update' : 'create',
      entity: 'expense',
      entityId: editing?.id ?? data.category,
    })
    setModalOpen(false)
    await load()
    await refresh()
  }

  async function confirmDelete() {
    if (!toDelete) return
    await deleteExpense(toDelete.id)
    setToDelete(null)
    await load()
  }

  const filtered = useMemo(() => {
    return expenses.filter((e) => {
      if (view === 'month') return e.period === month
      if (view === 'year') return e.period.startsWith(`${year}-`)
      if (view === 'quarter') return quarterMonths(year, quarter).includes(e.period)
      const f = rangeFrom <= rangeTo ? rangeFrom : rangeTo
      const t = rangeFrom <= rangeTo ? rangeTo : rangeFrom
      return e.period >= f && e.period <= t
    })
  }, [expenses, view, month, year, quarter, rangeFrom, rangeTo])

  const sorted = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1
    return [...filtered].sort((a, b) => {
      let cmp = 0
      if (sortKey === 'amount') cmp = (a.amount || 0) - (b.amount || 0)
      else if (sortKey === 'category') cmp = a.category.localeCompare(b.category, 'el')
      else if (sortKey === 'code') cmp = (a.code ?? '').localeCompare(b.code ?? '', 'el')
      else cmp = dateKey(a).localeCompare(dateKey(b))
      return cmp * dir
    })
  }, [filtered, sortKey, sortDir])

  const total = sorted.reduce((s, e) => s + e.amount, 0)
  const needsScale = form.method === 'millesime' || form.method === 'heating'

  const allParticipating =
    sortedApartments.length > 0 && sortedApartments.every((a) => form.participantIds.includes(a.id))
  function toggleParticipant(id: string) {
    setForm((f) => ({
      ...f,
      participantIds: f.participantIds.includes(id)
        ? f.participantIds.filter((x) => x !== id)
        : [...f.participantIds, id],
    }))
  }
  function toggleAllParticipants() {
    setForm((f) => ({
      ...f,
      participantIds: allParticipating ? [] : sortedApartments.map((a) => a.id),
    }))
  }

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(k)
      setSortDir(k === 'amount' || k === 'date' ? 'desc' : 'asc')
    }
  }

  const Th = ({ k, label, right }: { k: SortKey; label: string; right?: boolean }) => (
    <th className={`px-3 py-2 ${right ? 'text-right' : ''}`}>
      <button
        onClick={() => toggleSort(k)}
        className={`inline-flex items-center gap-1 hover:text-gray-700 ${right ? 'flex-row-reverse' : ''}`}
      >
        {label}
        <ArrowUpDown size={12} className={sortKey === k ? 'text-blue-600' : 'text-gray-300'} />
      </button>
    </th>
  )

  return (
    <div>
      <PageHeader
        title="Δαπάνες"
        subtitle={`${sorted.length} δαπάνες · σύνολο ${money(total)}`}
        actions={
          isManager && (
            <Button onClick={openNew}>
              <Plus size={18} /> Νέα δαπάνη
            </Button>
          )
        }
      />

      {/* Φίλτρα */}
      <Card className="mb-3">
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Προβολή">
            <SelectField value={view} onChange={(e) => setView(e.target.value as ViewMode)}>
              <option value="month">Μήνας</option>
              <option value="quarter">Τρίμηνο</option>
              <option value="year">Έτος</option>
              <option value="range">Εύρος</option>
            </SelectField>
          </Field>

          {view === 'month' && (
            <Field label="Μήνας">
              <input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </Field>
          )}
          {view === 'quarter' && (
            <>
              <Field label="Τρίμηνο">
                <SelectField value={quarter} onChange={(e) => setQuarter(Number(e.target.value))}>
                  <option value={1}>Α΄ (Ιαν–Μαρ)</option>
                  <option value={2}>Β΄ (Απρ–Ιουν)</option>
                  <option value={3}>Γ΄ (Ιουλ–Σεπ)</option>
                  <option value={4}>Δ΄ (Οκτ–Δεκ)</option>
                </SelectField>
              </Field>
              <Field label="Έτος">
                <input
                  type="number"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  className="w-24 rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </Field>
            </>
          )}
          {view === 'year' && (
            <Field label="Έτος">
              <input
                type="number"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className="w-28 rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </Field>
          )}
          {view === 'range' && (
            <>
              <Field label="Από">
                <input
                  type="month"
                  value={rangeFrom}
                  onChange={(e) => setRangeFrom(e.target.value)}
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </Field>
              <Field label="Έως">
                <input
                  type="month"
                  value={rangeTo}
                  onChange={(e) => setRangeTo(e.target.value)}
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </Field>
            </>
          )}
        </div>
      </Card>

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs uppercase text-gray-500">
              <Th k="code" label="Κωδ." />
              <Th k="date" label="Ημ/νία" />
              <Th k="category" label="Κατηγορία" />
              <th className="px-3 py-2">Ομάδα</th>
              <th className="px-3 py-2">Επιμερισμός</th>
              <Th k="amount" label="Ποσό" right />
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && !loading && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-gray-400">
                  Δεν υπάρχουν δαπάνες για την επιλεγμένη προβολή.
                </td>
              </tr>
            )}
            {sorted.map((e) => (
              <tr key={e.id} className="border-t border-gray-100 hover:bg-gray-50">
                <td className="px-3 py-2 tnum text-xs text-gray-500">{e.code ?? '—'}</td>
                <td className="px-3 py-2 whitespace-nowrap text-gray-600">{displayDate(e)}</td>
                <td className="px-3 py-2 font-medium text-gray-900">
                  <span className="inline-flex items-center gap-1.5">
                    {e.category}
                    {e.chargeType === 'special' && <Badge color="amber">Έκτακτη</Badge>}
                    {Array.isArray(e.participantApartmentIds) &&
                      e.participantApartmentIds.length > 0 && (
                        <Badge color="purple">
                          {e.participantApartmentIds.length} διαμ.
                        </Badge>
                      )}
                    {e.receiptUrl && (
                      <a
                        href={e.receiptUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-gray-400 hover:text-blue-600"
                        title="Παραστατικό"
                      >
                        <Paperclip size={14} />
                      </a>
                    )}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <Badge color="blue">{GROUP_LABELS[e.group]}</Badge>
                </td>
                <td className="px-3 py-2 text-gray-500">{ALLOCATION_LABELS[e.method]}</td>
                <td className="px-3 py-2 text-right tnum font-medium">{money(e.amount)}</td>
                <td className="px-3 py-2">
                  {isManager && (
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => openEdit(e)}
                        className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-blue-600"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={() => setToDelete(e)}
                        className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-red-600"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          {sorted.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-gray-200 bg-gray-50 font-semibold">
                <td className="px-3 py-2" colSpan={5}>
                  ΣΥΝΟΛΟ ({sorted.length})
                </td>
                <td className="px-3 py-2 text-right tnum">{money(total)}</td>
                <td></td>
              </tr>
            </tfoot>
          )}
        </table>
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Επεξεργασία δαπάνης' : 'Νέα δαπάνη'}
        wide
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Ακύρωση
            </Button>
            <Button onClick={save} disabled={uploading}>
              {uploading ? 'Αποθήκευση…' : 'Αποθήκευση'}
            </Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Μήνας δαπάνης">
            <input
              type="month"
              value={form.period}
              onChange={(e) => setForm({ ...form, period: e.target.value })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Ημ/νία παραστατικού (προαιρετικό)">
            <TextField type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </Field>
          <Field label="Χρέωση" hint="«Έκτακτη» → δεν μπαίνει στη μηνιαία έκδοση· κατανέμεται σε έκτακτη.">
            <SelectField
              value={form.chargeType}
              onChange={(e) => setForm({ ...form, chargeType: e.target.value as ExpenseChargeType })}
            >
              <option value="period">Περιόδου</option>
              <option value="special">Έκτακτη</option>
            </SelectField>
          </Field>
          <Field label="Κατηγορία">
            <TextField value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
          </Field>
          <Field label="Ομάδα (στήλη)">
            <SelectField value={form.group} onChange={(e) => setForm({ ...form, group: e.target.value as ExpenseGroup })}>
              {GROUP_ORDER.map((g) => (
                <option key={g} value={g}>
                  {GROUP_LABELS[g]}
                </option>
              ))}
            </SelectField>
          </Field>
          <Field label="Ποσό (€)">
            <NumberField step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} />
          </Field>
          <Field label="Μέθοδος επιμερισμού">
            <SelectField value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value as AllocationMethod })}>
              {(Object.keys(ALLOCATION_LABELS) as AllocationMethod[]).map((m) => (
                <option key={m} value={m}>
                  {ALLOCATION_LABELS[m]}
                </option>
              ))}
            </SelectField>
          </Field>
          {needsScale && (
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
          <div className="sm:col-span-2">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">
                Συμμετέχοντα διαμερίσματα{' '}
                <span className="font-normal text-gray-400">
                  ({form.participantIds.length}/{sortedApartments.length})
                </span>
              </span>
              <button
                type="button"
                onClick={toggleAllParticipants}
                className="rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50"
              >
                {allParticipating ? 'Κανένα' : 'Όλα'}
              </button>
            </div>
            <p className="mb-1 text-xs text-gray-500">
              Προεπιλογή: όλα συμμετέχουν. Ξετίκαρε όσα δεν συμμετέχουν — η δαπάνη επιμερίζεται μόνο
              στα επιλεγμένα (με αναπροσαρμογή των χιλιοστών).
            </p>
            <div className="grid max-h-44 grid-cols-2 gap-1 overflow-y-auto rounded-md border border-gray-200 p-2 sm:grid-cols-3">
              {sortedApartments.map((a) => (
                <label
                  key={a.id}
                  className="flex items-center gap-1.5 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <input
                    type="checkbox"
                    className="shrink-0"
                    checked={form.participantIds.includes(a.id)}
                    onChange={() => toggleParticipant(a.id)}
                  />
                  <span className="font-medium">{a.code}</span>
                  {a.ownerName && <span className="truncate text-gray-500">— {a.ownerName}</span>}
                </label>
              ))}
            </div>
            {form.participantIds.length === 0 && (
              <p className="mt-1 text-xs text-red-600">Επίλεξε τουλάχιστον ένα διαμέρισμα.</p>
            )}
          </div>
          <div className="sm:col-span-2">
            <Field label="Σημείωση (προαιρετικό)">
              <TextField value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Παραστατικό (εικόνα ή PDF)">
              <input
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => {
                  setFile(e.target.files?.[0] ?? null)
                  setAiMsg(null)
                }}
                className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-md file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100"
              />
              {file && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Button variant="secondary" onClick={analyze} disabled={aiBusy}>
                    <Sparkles size={16} /> {aiBusy ? 'Ανάλυση…' : 'Ανάλυση AI'}
                  </Button>
                  <span className="text-xs text-gray-500">Αυτόματη συμπλήρωση φόρμας από το παραστατικό</span>
                </div>
              )}
              {aiMsg && <p className="mt-1 text-xs text-gray-500">{aiMsg}</p>}
              <UploadProgress value={uploadPct} />
              {form.receiptUrl && !file && (
                <a
                  href={form.receiptUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
                >
                  <Paperclip size={14} /> {form.receiptName ?? 'Τρέχον παραστατικό'}
                </a>
              )}
            </Field>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!toDelete}
        message={`Διαγραφή δαπάνης «${toDelete?.category}»;`}
        onCancel={() => setToDelete(null)}
        onConfirm={confirmDelete}
      />
    </div>
  )
}
