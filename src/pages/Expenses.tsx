import { useEffect, useState } from 'react'
import { Plus, Trash2, Pencil, Sparkles } from 'lucide-react'
import { useAppData } from '@/lib/appData'
import { useAuth } from '@/lib/auth'
import { Button, Card, PageHeader, Field, TextField, NumberField, SelectField, Badge } from '@/components/forms'
import { Modal } from '@/components/Modal'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { money, currentPeriod, formatPeriod } from '@/lib/format'
import type { AllocationMethod, Expense, ExpenseGroup } from '@/types'
import { ALLOCATION_LABELS, GROUP_LABELS, GROUP_ORDER } from '@/types'
import { listExpenses, createExpense, updateExpense, deleteExpense } from '@/lib/repos/expenses'
import { uploadReceipt } from '@/lib/upload'
import { analyzeReceipt } from '@/lib/ocr'
import { UploadProgress } from '@/components/UploadProgress'
import { logAudit } from '@/lib/audit'
import { Paperclip } from 'lucide-react'

type FormState = {
  group: ExpenseGroup
  category: string
  amount: number
  method: AllocationMethod
  scaleKey: string
  note: string
  receiptUrl?: string
  receiptName?: string
  receiptPath?: string
}

export default function Expenses() {
  const { building, refresh } = useAppData()
  const { isManager, user, profile } = useAuth()
  const scales = building?.scales ?? []
  const [period, setPeriod] = useState(currentPeriod())
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Expense | null>(null)
  const [toDelete, setToDelete] = useState<Expense | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadPct, setUploadPct] = useState<number | null>(null)
  const [aiBusy, setAiBusy] = useState(false)
  const [aiMsg, setAiMsg] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>({
    group: 'koinoxrista',
    category: '',
    amount: 0,
    method: 'millesime',
    scaleKey: scales[0]?.key ?? 'genika',
    note: '',
  })

  async function load() {
    if (!building) return
    setLoading(true)
    try {
      setExpenses(await listExpenses(building.id, period))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [building, period])

  function openNew() {
    setEditing(null)
    setFile(null)
    setForm({
      group: 'koinoxrista',
      category: '',
      amount: 0,
      method: 'millesime',
      scaleKey: scales[0]?.key ?? 'genika',
      note: '',
    })
    setModalOpen(true)
  }

  function openEdit(e: Expense) {
    setEditing(e)
    setFile(null)
    setForm({
      group: e.group,
      category: e.category,
      amount: e.amount,
      method: e.method,
      scaleKey: e.scaleKey ?? scales[0]?.key ?? 'genika',
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
        note: f.note || [res.merchant, res.date].filter(Boolean).join(' · '),
      }))
      const got = [
        res.amount != null ? 'ποσό' : null,
        res.category ? 'κατηγορία' : null,
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
      period,
      group: form.group,
      category: form.category.trim(),
      amount: Number(form.amount) || 0,
      method: form.method,
      scaleKey: form.method === 'millesime' || form.method === 'heating' ? form.scaleKey : undefined,
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
      after: data,
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

  const total = expenses.reduce((s, e) => s + e.amount, 0)
  const needsScale = form.method === 'millesime' || form.method === 'heating'

  return (
    <div>
      <PageHeader
        title="Δαπάνες"
        subtitle={`${formatPeriod(period)} · σύνολο ${money(total)}`}
        actions={
          <>
            <input
              type="month"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
            {isManager && (
              <Button onClick={openNew}>
                <Plus size={18} /> Νέα δαπάνη
              </Button>
            )}
          </>
        }
      />

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs uppercase text-gray-500">
              <th className="px-3 py-2">Κατηγορία</th>
              <th className="px-3 py-2">Ομάδα</th>
              <th className="px-3 py-2">Επιμερισμός</th>
              <th className="px-3 py-2 text-right">Ποσό</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {expenses.length === 0 && !loading && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-gray-400">
                  Δεν υπάρχουν δαπάνες για {formatPeriod(period)}.
                </td>
              </tr>
            )}
            {expenses.map((e) => (
              <tr key={e.id} className="border-t border-gray-100 hover:bg-gray-50">
                <td className="px-3 py-2 font-medium text-gray-900">
                  <span className="inline-flex items-center gap-1.5">
                    {e.category}
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
          {expenses.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-gray-200 bg-gray-50 font-semibold">
                <td className="px-3 py-2" colSpan={3}>
                  ΣΥΝΟΛΟ
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
        <div className="space-y-3">
          <Field label="Κατηγορία / Περιγραφή">
            <TextField
              placeholder="π.χ. ΔΕΗ κοινοχρήστων"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Ομάδα (στήλη κατάστασης)">
              <SelectField
                value={form.group}
                onChange={(e) => setForm({ ...form, group: e.target.value as ExpenseGroup })}
              >
                {GROUP_ORDER.map((g) => (
                  <option key={g} value={g}>
                    {GROUP_LABELS[g]}
                  </option>
                ))}
              </SelectField>
            </Field>
            <Field label="Ποσό (€)">
              <NumberField
                step="0.01"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
              />
            </Field>
            <Field label="Τρόπος επιμερισμού">
              <SelectField
                value={form.method}
                onChange={(e) => setForm({ ...form, method: e.target.value as AllocationMethod })}
              >
                {(Object.keys(ALLOCATION_LABELS) as AllocationMethod[]).map((m) => (
                  <option key={m} value={m}>
                    {ALLOCATION_LABELS[m]}
                  </option>
                ))}
              </SelectField>
            </Field>
            {needsScale && (
              <Field label="Πίνακας χιλιοστών">
                <SelectField
                  value={form.scaleKey}
                  onChange={(e) => setForm({ ...form, scaleKey: e.target.value })}
                >
                  {scales.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.label}
                    </option>
                  ))}
                </SelectField>
              </Field>
            )}
          </div>
          <Field label="Σημείωση (προαιρετικό)">
            <TextField value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </Field>
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
