import { useEffect, useMemo, useState } from 'react'
import { Mail, Smartphone, Layers, Send, CheckCircle2, XCircle } from 'lucide-react'
import { Button, Field, Badge } from '@/components/forms'
import { Modal } from '@/components/Modal'
import { money, formatDate } from '@/lib/format'
import type { Building, Statement, UserDoc, Apartment } from '@/types'
import { listUsersByBuildings } from '@/lib/repos/users'
import { sendBulkMessage } from '@/lib/messaging'
import { paymentCodeFor } from '@/lib/paymentCode'
import {
  renderNotice,
  defaultNoticeEmailSubject,
  defaultNoticeEmailTemplate,
  defaultNoticeSmsTemplate,
} from '@/lib/noticeTemplate'

type Channel = 'email' | 'sms' | 'both'

const isEmail = (s: string) => s.includes('@')
const isPhone = (s: string) => /^\+?\d[\d\s]{6,}$/.test(s)

function phoneOf(u: UserDoc): string {
  if (isPhone(u.email)) return u.email
  if (u.phone && isPhone(u.phone)) return u.phone
  return ''
}

interface Recipient {
  user: UserDoc
  codes: string[]
  refs: string[]
  totalDue: number
  phoneId: string
  byEmail: boolean
  bySms: boolean
}

interface SendLine { id: string; ok: boolean; reason?: string; channel: 'email' | 'sms' }

export function StatementNotifyModal({
  st,
  building,
  apartments,
  open,
  onClose,
}: {
  st: Statement
  building: Building
  apartments: Apartment[]
  open: boolean
  onClose: () => void
}) {
  const [users, setUsers] = useState<UserDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [channel, setChannel] = useState<Channel>('email')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [emailSubject, setEmailSubject] = useState('')
  const [emailBody, setEmailBody] = useState('')
  const [smsBody, setSmsBody] = useState('')
  const [sending, setSending] = useState(false)
  const [lines, setLines] = useState<SendLine[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const iban = building.iban ?? ''
  const dueStr = useMemo(() => {
    const issued = st.createdAt?.toDate?.() ?? null
    if (!issued) return '—'
    const due = new Date(issued.getTime() + (building.paymentDueDays ?? 30) * 86400000)
    return formatDate(due)
  }, [st.createdAt, building.paymentDueDays])

  const constVars = useMemo<Record<string, string>>(
    () => ({
      period: st.periodLabel,
      due: dueStr,
      iban,
      bank: building.bankName ?? '',
      company: building.companyName ?? '',
      building: st.buildingName,
      link: `${window.location.origin}/`,
    }),
    [st.periodLabel, st.buildingName, dueStr, iban, building.bankName, building.companyName],
  )

  const recipients = useMemo<Recipient[]>(() => {
    const rowByApt = new Map(st.rows.map((r) => [r.apartmentId, r]))
    const aptById = new Map(apartments.map((a) => [a.id, a]))
    const out: Recipient[] = []
    for (const u of users) {
      const ids = (u.apartmentIds ?? []).filter((id) => rowByApt.has(id))
      if (ids.length === 0) continue
      const rows = ids.map((id) => rowByApt.get(id)!)
      const phoneId = phoneOf(u)
      out.push({
        user: u,
        codes: rows.map((r) => r.code),
        refs: ids.map((id) => paymentCodeFor(aptById.get(id), st.buildingCode, rowByApt.get(id)!.code)),
        totalDue: rows.reduce((s, r) => s + r.total, 0),
        phoneId,
        byEmail: isEmail(u.email),
        bySms: isPhone(phoneId),
      })
    }
    return out.sort((a, b) => (a.user.name || a.user.email).localeCompare(b.user.name || b.user.email, 'el'))
  }, [users, st.rows, st.buildingCode, apartments])

  useEffect(() => {
    if (!open) return
    setLines(null)
    setError(null)
    setLoading(true)
    setEmailSubject(building.noticeEmailSubject || defaultNoticeEmailSubject())
    setEmailBody(building.noticeEmailTemplate || defaultNoticeEmailTemplate())
    setSmsBody(building.noticeSmsTemplate || defaultNoticeSmsTemplate())
    listUsersByBuildings([building.id])
      .then((all) => setUsers(all.filter((u) => u.active !== false)))
      .finally(() => setLoading(false))
  }, [open, building])

  // Απαιτούμενη δυνατότητα λήψης ανά κανάλι.
  const canReach = (r: Recipient) =>
    channel === 'email' ? r.byEmail : channel === 'sms' ? r.bySms : r.byEmail || r.bySms

  const selectable = useMemo(() => recipients.filter(canReach), [recipients, channel])
  const selectedList = useMemo(
    () => selectable.filter((r) => selected.has(r.user.email)),
    [selectable, selected],
  )
  const allSelected = selectable.length > 0 && selectedList.length === selectable.length

  function toggleAll() {
    setLines(null)
    setSelected((prev) => {
      const next = new Set(prev)
      if (allSelected) selectable.forEach((r) => next.delete(r.user.email))
      else selectable.forEach((r) => next.add(r.user.email))
      return next
    })
  }
  function toggle(id: string) {
    setLines(null)
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const varsFor = (r: Recipient): Record<string, string> => ({
    ...constVars,
    name: r.user.name || '',
    apts: r.codes.join(', '),
    ref: r.refs.join(', '),
    amount: money(r.totalDue),
  })

  const wantEmail = channel === 'email' || channel === 'both'
  const wantSms = channel === 'sms' || channel === 'both'

  const canSend =
    selectedList.length > 0 &&
    (!wantEmail || (emailBody.trim() && emailSubject.trim())) &&
    (!wantSms || smsBody.trim())

  async function doSend() {
    setSending(true)
    setError(null)
    setLines(null)
    const collected: SendLine[] = []
    try {
      if (wantEmail) {
        const rs = selectedList.filter((r) => r.byEmail)
        if (rs.length) {
          const bodies: Record<string, string> = {}
          rs.forEach((r) => (bodies[r.user.email] = renderNotice(emailBody, varsFor(r))))
          const res = await sendBulkMessage({
            channel: 'email',
            subject: renderNotice(emailSubject, constVars),
            bodies,
            recipientIds: rs.map((r) => r.user.email),
          })
          res.results.forEach((x) => collected.push({ ...x, channel: 'email' }))
        }
      }
      if (wantSms) {
        const rs = selectedList.filter((r) => r.bySms)
        if (rs.length) {
          const bodies: Record<string, string> = {}
          rs.forEach((r) => (bodies[r.user.email] = renderNotice(smsBody, varsFor(r))))
          const res = await sendBulkMessage({
            channel: 'sms',
            bodies,
            recipientIds: rs.map((r) => r.user.email),
          })
          res.results.forEach((x) => collected.push({ ...x, channel: 'sms' }))
        }
      }
      setLines(collected)
    } catch (e) {
      setError((e as Error).message || 'Αποτυχία αποστολής.')
    } finally {
      setSending(false)
    }
  }

  const sentCount = lines?.filter((l) => l.ok).length ?? 0
  const failCount = lines ? lines.length - sentCount : 0
  const first = selectedList[0]

  const CH: { key: Channel; label: string; icon: typeof Mail }[] = [
    { key: 'email', label: 'Email', icon: Mail },
    { key: 'sms', label: 'SMS', icon: Smartphone },
    { key: 'both', label: 'Και τα δύο', icon: Layers },
  ]

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
          {lines && (
            <div className={`rounded-md p-2 text-sm ${failCount === 0 ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-800'}`}>
              <div className="flex items-center gap-2 font-medium">
                {failCount === 0 ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                {sentCount} στάλθηκαν{failCount > 0 ? `, ${failCount} απέτυχαν` : ''}
              </div>
              {failCount > 0 && (
                <ul className="mt-1 space-y-0.5 text-xs">
                  {lines.filter((l) => !l.ok).map((l, i) => (
                    <li key={i}>• [{l.channel}] {l.id} — {l.reason || 'σφάλμα'}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Κανάλι */}
          <div className="flex gap-2">
            {CH.map((c) => (
              <button
                key={c.key}
                onClick={() => { setChannel(c.key); setLines(null) }}
                className={`flex flex-1 items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition ${
                  channel === c.key ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                <c.icon size={16} /> {c.label}
              </button>
            ))}
          </div>

          {!iban && (
            <div className="rounded-md bg-amber-50 p-2 text-xs text-amber-700">
              Δεν έχει οριστεί ΙΒΑΝ στις «Ρυθμίσεις κτιρίου» — θα εμφανιστεί κενό στο μήνυμα.
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
                const ok = canReach(r)
                return (
                  <label key={r.user.email} className={`flex items-center gap-3 border-b border-gray-100 px-3 py-2 text-sm last:border-0 ${ok ? 'hover:bg-gray-50' : 'cursor-not-allowed bg-gray-50/50 opacity-60'}`}>
                    <input type="checkbox" disabled={!ok} checked={selected.has(r.user.email)} onChange={() => toggle(r.user.email)} />
                    <span className="min-w-0 flex-1 truncate">
                      <span className="font-medium text-gray-900">{r.user.name || r.user.email}</span>
                      <span className="ml-2 text-gray-500">{r.codes.join(', ')}</span>
                    </span>
                    <Badge color="gray">{money(r.totalDue)}</Badge>
                    {channel === 'both' && ok && (
                      <span className="shrink-0 text-xs text-gray-400">{[r.byEmail && 'email', r.bySms && 'sms'].filter(Boolean).join('+')}</span>
                    )}
                    {!ok && <span className="shrink-0 text-xs text-amber-600">χωρίς στοιχείο</span>}
                  </label>
                )
              })}
            </div>
          </div>

          {/* Κείμενα */}
          {wantEmail && (
            <div className="space-y-2 rounded-md border border-gray-200 p-3">
              <div className="text-xs font-semibold uppercase text-gray-500">Email</div>
              <Field label="Θέμα">
                <input value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none" />
              </Field>
              <Field label="Κείμενο">
                <textarea rows={8} value={emailBody} onChange={(e) => setEmailBody(e.target.value)} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none" />
              </Field>
              {first && (
                <div className="rounded-md bg-gray-50 p-2">
                  <div className="mb-1 text-xs font-medium text-gray-500">Προεπισκόπηση ({first.user.name || first.user.email})</div>
                  <pre className="whitespace-pre-wrap break-words text-xs text-gray-700">{renderNotice(emailBody, varsFor(first))}</pre>
                </div>
              )}
            </div>
          )}
          {wantSms && (
            <div className="space-y-2 rounded-md border border-gray-200 p-3">
              <div className="text-xs font-semibold uppercase text-gray-500">SMS</div>
              <Field label="Κείμενο">
                <textarea rows={4} value={smsBody} onChange={(e) => setSmsBody(e.target.value)} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none" />
              </Field>
              {first && (
                <div className="rounded-md bg-gray-50 p-2">
                  <div className="mb-1 text-xs font-medium text-gray-500">Προεπισκόπηση ({first.user.name || first.user.email})</div>
                  <pre className="whitespace-pre-wrap break-words text-xs text-gray-700">{renderNotice(smsBody, varsFor(first))}</pre>
                </div>
              )}
            </div>
          )}

          <p className="text-xs text-gray-400">
            Μεταβλητές: <code>{'{name}'}</code> <code>{'{apts}'}</code> <code>{'{amount}'}</code> <code>{'{ref}'}</code>{' '}
            <code>{'{period}'}</code> <code>{'{due}'}</code> <code>{'{iban}'}</code> <code>{'{bank}'}</code>{' '}
            <code>{'{company}'}</code> <code>{'{building}'}</code> <code>{'{link}'}</code>. Τα προεπιλεγμένα κείμενα ορίζονται στις «Ρυθμίσεις κτιρίου».
          </p>
        </div>
      )}
    </Modal>
  )
}
