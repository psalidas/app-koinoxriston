import { useEffect, useMemo, useState } from 'react'
import { Mail, Smartphone, Send, CheckCircle2, XCircle } from 'lucide-react'
import { useAppData } from '@/lib/appData'
import { Button, Card, PageHeader, Field, TextField, Badge } from '@/components/forms'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import type { Role, UserDoc } from '@/types'
import { ROLE_LABELS } from '@/types'
import { listUsers } from '@/lib/repos/users'
import { sendBulkMessage, type BulkResult } from '@/lib/messaging'

const isEmail = (s: string) => s.includes('@')
const isPhone = (s: string) => /^\+?\d[\d\s]{6,}$/.test(s)

/** Μπορεί ο χρήστης να λάβει στο συγκεκριμένο κανάλι; */
function reachable(u: UserDoc, channel: 'email' | 'sms'): boolean {
  if (channel === 'email') return isEmail(u.email)
  return isPhone(u.email) || (!!u.phone && isPhone(u.phone))
}

const ROLE_FILTERS: { key: 'all' | Role; label: string }[] = [
  { key: 'all', label: 'Όλοι οι ρόλοι' },
  { key: 'owner', label: 'Ιδιοκτήτες' },
  { key: 'resident', label: 'Ένοικοι' },
  { key: 'manager', label: 'Διαχειριστές' },
]

const SMS_LIMIT = 480 // ~3 τμήματα SMS (Unicode) — ασφαλές ανώτατο για προειδοποίηση

export default function Broadcast() {
  const { building } = useAppData()
  const [users, setUsers] = useState<UserDoc[]>([])
  const [loading, setLoading] = useState(true)

  const [channel, setChannel] = useState<'email' | 'sms'>('email')
  const [roleFilter, setRoleFilter] = useState<'all' | Role>('all')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')

  const [confirmOpen, setConfirmOpen] = useState(false)
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<BulkResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listUsers()
      .then((all) => setUsers(all.filter((u) => u.active !== false)))
      .finally(() => setLoading(false))
  }, [])

  // Λίστα με βάση φίλτρο ρόλου (ανεξάρτητα από δυνατότητα λήψης).
  const visible = useMemo(() => {
    const list = roleFilter === 'all' ? users : users.filter((u) => u.role === roleFilter)
    return [...list].sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email, 'el'))
  }, [users, roleFilter])

  // Επιλέξιμοι = ορατοί που μπορούν να λάβουν στο τρέχον κανάλι.
  const selectableIds = useMemo(
    () => visible.filter((u) => reachable(u, channel)).map((u) => u.email),
    [visible, channel],
  )

  // Οι πραγματικοί παραλήπτες = επιλεγμένοι ∩ επιλέξιμοι (στο κανάλι).
  const recipientIds = useMemo(
    () => selectableIds.filter((id) => selected.has(id)),
    [selectableIds, selected],
  )

  const allSelected = selectableIds.length > 0 && recipientIds.length === selectableIds.length

  function toggleAll() {
    setResult(null)
    setSelected((prev) => {
      const next = new Set(prev)
      if (allSelected) {
        selectableIds.forEach((id) => next.delete(id))
      } else {
        selectableIds.forEach((id) => next.add(id))
      }
      return next
    })
  }

  function toggle(id: string) {
    setResult(null)
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function pickChannel(c: 'email' | 'sms') {
    setChannel(c)
    setResult(null)
    setError(null)
  }

  const canSend =
    recipientIds.length > 0 && body.trim().length > 0 && (channel === 'sms' || subject.trim().length > 0)

  async function doSend() {
    setConfirmOpen(false)
    setSending(true)
    setError(null)
    setResult(null)
    try {
      const res = await sendBulkMessage({
        channel,
        subject: channel === 'email' ? subject.trim() : undefined,
        body: body.trim(),
        recipientIds,
      })
      setResult(res)
    } catch (e) {
      setError((e as Error).message || 'Αποτυχία αποστολής.')
    } finally {
      setSending(false)
    }
  }

  if (loading) return <div className="text-gray-400">Φόρτωση…</div>

  const nameFor = (id: string) => users.find((u) => u.email === id)?.name || id

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Μαζική αποστολή"
        subtitle="Στείλε email ή SMS σε επιλεγμένους χρήστες"
        actions={
          <Button onClick={() => setConfirmOpen(true)} disabled={!canSend || sending}>
            <Send size={18} /> {sending ? 'Αποστολή…' : `Αποστολή (${recipientIds.length})`}
          </Button>
        }
      />

      {error && <div className="mb-3 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {result && (
        <Card className="mb-4">
          <h2 className="mb-2 flex items-center gap-2 font-semibold text-gray-900">
            {result.failed === 0 ? (
              <CheckCircle2 size={18} className="text-green-600" />
            ) : (
              <XCircle size={18} className="text-amber-600" />
            )}
            Ολοκληρώθηκε — {result.sent} στάλθηκαν
            {result.failed > 0 ? `, ${result.failed} απέτυχαν` : ''}
          </h2>
          {result.failed > 0 && (
            <ul className="mt-1 space-y-1 text-sm text-gray-600">
              {result.results
                .filter((r) => !r.ok)
                .map((r) => (
                  <li key={r.id} className="flex items-start gap-2">
                    <XCircle size={14} className="mt-0.5 shrink-0 text-red-500" />
                    <span>
                      <b>{nameFor(r.id)}</b> ({r.id}) — {r.reason || 'σφάλμα'}
                    </span>
                  </li>
                ))}
            </ul>
          )}
        </Card>
      )}

      {/* Κανάλι */}
      <Card className="mb-4">
        <div className="mb-1 text-sm font-medium text-gray-700">Κανάλι αποστολής</div>
        <div className="flex gap-2">
          <button
            onClick={() => pickChannel('email')}
            className={`flex flex-1 items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition ${
              channel === 'email'
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Mail size={16} /> Email
          </button>
          <button
            onClick={() => pickChannel('sms')}
            className={`flex flex-1 items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition ${
              channel === 'sms'
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Smartphone size={16} /> SMS
          </button>
        </div>
        <p className="mt-2 text-xs text-gray-500">
          {channel === 'email'
            ? 'Στέλνεται σε χρήστες με διεύθυνση email (μέσω Brevo).'
            : 'Στέλνεται σε χρήστες με κινητό — ως αναγνωριστικό ή στο πεδίο «Κινητό» (μέσω sms.to).'}
        </p>
      </Card>

      {/* Παραλήπτες */}
      <Card className="mb-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm font-medium text-gray-700">
            Παραλήπτες{' '}
            <span className="font-normal text-gray-400">
              ({recipientIds.length}/{selectableIds.length} επιλέξιμοι)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as 'all' | Role)}
              className="rounded-md border border-gray-300 px-2 py-1 text-sm shadow-sm focus:border-blue-500 focus:outline-none"
            >
              {ROLE_FILTERS.map((f) => (
                <option key={f.key} value={f.key}>
                  {f.label}
                </option>
              ))}
            </select>
            <button
              onClick={toggleAll}
              disabled={selectableIds.length === 0}
              className="rounded-md border border-gray-200 px-2 py-1 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
            >
              {allSelected ? 'Κανένας' : 'Όλοι'}
            </button>
          </div>
        </div>

        <div className="max-h-72 overflow-y-auto rounded-md border border-gray-200">
          {visible.length === 0 && (
            <div className="px-3 py-8 text-center text-sm text-gray-400">Δεν υπάρχουν χρήστες.</div>
          )}
          {visible.map((u) => {
            const ok = reachable(u, channel)
            return (
              <label
                key={u.email}
                className={`flex items-center gap-3 border-b border-gray-100 px-3 py-2 text-sm last:border-0 ${
                  ok ? 'hover:bg-gray-50' : 'cursor-not-allowed bg-gray-50/50 opacity-60'
                }`}
              >
                <input
                  type="checkbox"
                  disabled={!ok}
                  checked={selected.has(u.email)}
                  onChange={() => toggle(u.email)}
                />
                <span className="min-w-0 flex-1 truncate">
                  <span className="font-medium text-gray-900">{u.name || u.email}</span>
                  <span className="ml-2 text-gray-500">{u.email}</span>
                </span>
                <Badge color="gray">{ROLE_LABELS[u.role]}</Badge>
                {!ok && (
                  <span className="shrink-0 text-xs text-amber-600">
                    {channel === 'email' ? 'χωρίς email' : 'χωρίς κινητό'}
                  </span>
                )}
              </label>
            )
          })}
        </div>
      </Card>

      {/* Μήνυμα */}
      <Card>
        <div className="mb-1 text-sm font-medium text-gray-700">Μήνυμα</div>
        <div className="mt-2 space-y-3">
          {channel === 'email' && (
            <Field label="Θέμα">
              <TextField value={subject} onChange={(e) => setSubject(e.target.value)} />
            </Field>
          )}
          <Field label={channel === 'email' ? 'Κείμενο email' : 'Κείμενο SMS'}>
            <textarea
              rows={channel === 'email' ? 8 : 4}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={channel === 'email' ? 'Γράψτε το μήνυμα…' : 'Σύντομο μήνυμα SMS…'}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </Field>
          {channel === 'sms' && (
            <p className={`text-xs ${body.length > SMS_LIMIT ? 'text-amber-600' : 'text-gray-400'}`}>
              {body.length} χαρακτήρες
              {body.length > SMS_LIMIT ? ' — μεγάλο μήνυμα, θα χρεωθεί ως πολλαπλά SMS.' : ''}
            </p>
          )}
        </div>
      </Card>

      <ConfirmDialog
        open={confirmOpen}
        message={`Αποστολή ${channel === 'email' ? 'email' : 'SMS'} σε ${recipientIds.length} ${
          recipientIds.length === 1 ? 'παραλήπτη' : 'παραλήπτες'
        }${building ? ` (${building.name})` : ''};`}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={doSend}
      />
    </div>
  )
}
