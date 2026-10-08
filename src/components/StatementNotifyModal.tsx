import { useEffect, useMemo, useState } from 'react'
import { Mail, Smartphone, Send, CheckCircle2, XCircle } from 'lucide-react'
import { Button, Field, Badge } from '@/components/forms'
import { Modal } from '@/components/Modal'
import { money, formatDate } from '@/lib/format'
import type { Building, Statement, UserDoc } from '@/types'
import { listUsersByBuildings } from '@/lib/repos/users'
import { sendBulkMessage, type BulkResult } from '@/lib/messaging'

const isEmail = (s: string) => s.includes('@')
const isPhone = (s: string) => /^\+?\d[\d\s]{6,}$/.test(s)

function reachable(u: UserDoc, phoneId: string, channel: 'email' | 'sms'): boolean {
  if (channel === 'email') return isEmail(u.email)
  return isPhone(phoneId)
}

interface Recipient {
  user: UserDoc
  codes: string[]
  totalDue: number
  phoneId: string
}

/** Υπολογίζει το κινητό ενός χρήστη (αναγνωριστικό ή πεδίο phone). */
function phoneOf(u: UserDoc): string {
  if (isPhone(u.email)) return u.email
  if (u.phone && isPhone(u.phone)) return u.phone
  return ''
}

export function StatementNotifyModal({
  st,
  building,
  open,
  onClose,
}: {
  st: Statement
  building: Building
  open: boolean
  onClose: () => void
}) {
  const [users, setUsers] = useState<UserDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [channel, setChannel] = useState<'email' | 'sms'>('email')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<BulkResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const iban = building.iban ?? ''
  const dueStr = useMemo(() => {
    const issued = st.createdAt?.toDate?.() ?? null
    if (!issued) return '—'
    const due = new Date(issued.getTime() + (building.paymentDueDays ?? 30) * 86400000)
    return formatDate(due)
  }, [st.createdAt, building.paymentDueDays])

  // Παραλήπτες: χρήστες με διαμέρισμα που εμφανίζεται στην έκδοση.
  const recipients = useMemo<Recipient[]>(() => {
    const rowByApt = new Map(st.rows.map((r) => [r.apartmentId, r]))
    const out: Recipient[] = []
    for (const u of users) {
      const apts = (u.apartmentIds ?? []).map((id) => rowByApt.get(id)).filter(Boolean) as typeof st.rows
      if (apts.length === 0) continue
      out.push({
        user: u,
        codes: apts.map((r) => r.code),
        totalDue: apts.reduce((s, r) => s + r.total, 0),
        phoneId: phoneOf(u),
      })
    }
    return out.sort((a, b) => (a.user.name || a.user.email).localeCompare(b.user.name || b.user.email, 'el'))
  }, [users, st.rows])

  useEffect(() => {
    if (!open) return
    setResult(null)
    setError(null)
    setLoading(true)
    listUsersByBuildings([building.id])
      .then((all) => setUsers(all.filter((u) => u.active !== false)))
      .finally(() => setLoading(false))
  }, [open, building.id])

  // Προεπιλεγμένα κείμενα (ανανεώνονται με το κανάλι & τα στοιχεία).
  useEffect(() => {
    if (!open) return
    const paymentInfo = [
      building.companyName && `Δικαιούχος: ${building.companyName}`,
      building.bankName && `Τράπεζα: ${building.bankName}`,
      iban && `IBAN: ${iban}`,
    ]
      .filter(Boolean)
      .join('\n')
    setSubject(`Κοινόχρηστα ${st.periodLabel} — ${st.buildingName}`)
    if (channel === 'email') {
      setBody(
        `Αγαπητέ/ή {name},\n\n` +
          `Εκδόθηκαν τα κοινόχρηστα περιόδου ${st.periodLabel} για το/τα διαμέρισμα/τα {apts}.\n` +
          `Ποσό πληρωμής: {amount}\n` +
          `Προθεσμία πληρωμής: ${dueStr}\n\n` +
          (paymentInfo ? `Στοιχεία πληρωμής:\n${paymentInfo}\n\n` : '') +
          `${st.buildingName}`,
      )
    } else {
      setBody(
        `Κοινόχρηστα ${st.periodLabel}: οφειλή {amount} για {apts}, έως ${dueStr}.` +
          (iban ? ` IBAN ${iban}` : ''),
      )
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, channel, st.periodLabel, iban, building.companyName, building.bankName, dueStr])

  // Επιλέξιμοι στο τρέχον κανάλι.
  const selectable = useMemo(
    () => recipients.filter((r) => reachable(r.user, r.phoneId, channel)),
    [recipients, channel],
  )
  const selectedList = useMemo(
    () => selectable.filter((r) => selected.has(r.user.email)),
    [selectable, selected],
  )
  const allSelected = selectable.length > 0 && selectedList.length === selectable.length

  function toggleAll() {
    setResult(null)
    setSelected((prev) => {
      const next = new Set(prev)
      if (allSelected) selectable.forEach((r) => next.delete(r.user.email))
      else selectable.forEach((r) => next.add(r.user.email))
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

  function renderFor(r: Recipient): string {
    return body
      .replace(/\{name\}/g, r.user.name || '')
      .replace(/\{apts\}/g, r.codes.join(', '))
      .replace(/\{amount\}/g, money(r.totalDue))
  }

  const preview = selectedList[0] ? renderFor(selectedList[0]) : null
  const canSend = selectedList.length > 0 && body.trim().length > 0 && (channel === 'sms' || subject.trim())

  async function doSend() {
    setSending(true)
    setError(null)
    setResult(null)
    try {
      const bodies: Record<string, string> = {}
      for (const r of selectedList) bodies[r.user.email] = renderFor(r)
      const res = await sendBulkMessage({
        channel,
        subject: channel === 'email' ? subject.trim() : undefined,
        bodies,
        recipientIds: selectedList.map((r) => r.user.email),
      })
      setResult(res)
    } catch (e) {
      setError((e as Error).message || 'Αποτυχία αποστολής.')
    } finally {
      setSending(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Ειδοποίηση έκδοσης κοινοχρήστων"
      wide
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Κλείσιμο</Button>
          <Button onClick={doSend} disabled={!canSend || sending}>
            <Send size={16} /> {sending ? 'Αποστολή…' : `Αποστολή (${selectedList.length})`}
          </Button>
        </>
      }
    >
      {loading ? (
        <div className="py-8 text-center text-gray-400">Φόρτωση παραληπτών…</div>
      ) : (
        <div className="space-y-4">
          {error && <div className="rounded-md bg-red-50 p-2 text-sm text-red-700">{error}</div>}
          {result && (
            <div className={`rounded-md p-2 text-sm ${result.failed === 0 ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-800'}`}>
              <div className="flex items-center gap-2 font-medium">
                {result.failed === 0 ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                {result.sent} στάλθηκαν{result.failed > 0 ? `, ${result.failed} απέτυχαν` : ''}
              </div>
              {result.failed > 0 && (
                <ul className="mt-1 space-y-0.5 text-xs">
                  {result.results.filter((r) => !r.ok).map((r) => (
                    <li key={r.id}>• {r.id} — {r.reason || 'σφάλμα'}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Κανάλι */}
          <div className="flex gap-2">
            {(['email', 'sms'] as const).map((c) => (
              <button
                key={c}
                onClick={() => { setChannel(c); setResult(null) }}
                className={`flex flex-1 items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition ${
                  channel === c ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {c === 'email' ? <Mail size={16} /> : <Smartphone size={16} />} {c === 'email' ? 'Email' : 'SMS'}
              </button>
            ))}
          </div>

          {!iban && (
            <div className="rounded-md bg-amber-50 p-2 text-xs text-amber-700">
              Δεν έχει οριστεί ΙΒΑΝ στις «Ρυθμίσεις κτιρίου» — δεν θα συμπεριληφθεί στο μήνυμα.
            </div>
          )}

          {/* Παραλήπτες */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">
                Παραλήπτες <span className="font-normal text-gray-400">({selectedList.length}/{selectable.length})</span>
              </span>
              <button onClick={toggleAll} disabled={selectable.length === 0} className="rounded-md border border-gray-200 px-2 py-1 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50">
                {allSelected ? 'Κανένας' : 'Όλοι'}
              </button>
            </div>
            <div className="max-h-56 overflow-y-auto rounded-md border border-gray-200">
              {recipients.length === 0 && (
                <div className="px-3 py-6 text-center text-sm text-gray-400">
                  Κανένας χρήστης δεν έχει αντιστοιχιστεί σε διαμέρισμα της έκδοσης.
                </div>
              )}
              {recipients.map((r) => {
                const ok = reachable(r.user, r.phoneId, channel)
                return (
                  <label key={r.user.email} className={`flex items-center gap-3 border-b border-gray-100 px-3 py-2 text-sm last:border-0 ${ok ? 'hover:bg-gray-50' : 'cursor-not-allowed bg-gray-50/50 opacity-60'}`}>
                    <input type="checkbox" disabled={!ok} checked={selected.has(r.user.email)} onChange={() => toggle(r.user.email)} />
                    <span className="min-w-0 flex-1 truncate">
                      <span className="font-medium text-gray-900">{r.user.name || r.user.email}</span>
                      <span className="ml-2 text-gray-500">{r.codes.join(', ')}</span>
                    </span>
                    <Badge color="gray">{money(r.totalDue)}</Badge>
                    {!ok && <span className="shrink-0 text-xs text-amber-600">{channel === 'email' ? 'χωρίς email' : 'χωρίς κινητό'}</span>}
                  </label>
                )
              })}
            </div>
          </div>

          {/* Μήνυμα */}
          {channel === 'email' && (
            <Field label="Θέμα">
              <input value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none" />
            </Field>
          )}
          <Field label="Κείμενο">
            <textarea
              rows={channel === 'email' ? 9 : 4}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none"
            />
          </Field>
          <p className="text-xs text-gray-400">
            Μεταβλητές που αντικαθίστανται ανά παραλήπτη: <code>{'{name}'}</code> όνομα,{' '}
            <code>{'{apts}'}</code> διαμερίσματα, <code>{'{amount}'}</code> οφειλή.
          </p>

          {preview && (
            <div className="rounded-md border border-gray-200 bg-gray-50 p-2">
              <div className="mb-1 text-xs font-medium text-gray-500">Προεπισκόπηση ({selectedList[0].user.name || selectedList[0].user.email})</div>
              <pre className="whitespace-pre-wrap break-words text-xs text-gray-700">{preview}</pre>
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}
