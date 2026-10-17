import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Printer } from 'lucide-react'
import { useAppData } from '@/lib/appData'
import { useAuth } from '@/lib/auth'
import { Button } from '@/components/forms'
import { Footer } from '@/components/Footer'
import { mille, formatDate, formatDateTime } from '@/lib/format'
import type { Poll, Vote } from '@/types'
import { POLL_WEIGHT_LABELS } from '@/types'
import { getPoll, listVotes, tallyVotes } from '@/lib/repos/polls'

/** Εκτυπώσιμο πρακτικό ψηφοφορίας (μόνο διαχειριστής). */
export default function PollMinutes() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { building, apartments } = useAppData()
  const { isManager } = useAuth()
  const [poll, setPoll] = useState<Poll | null>(null)
  const [votes, setVotes] = useState<Vote[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    void (async () => {
      try {
        const [p, v] = await Promise.all([getPoll(id), listVotes(id)])
        setPoll(p)
        setVotes(v)
      } finally {
        setLoading(false)
      }
    })()
  }, [id])

  const aptCode = useMemo(() => new Map(apartments.map((a) => [a.id, a.code])), [apartments])

  if (loading) return <div className="text-gray-400">Φόρτωση…</div>
  if (!isManager) return <div className="text-gray-500">Δεν έχετε πρόσβαση στο πρακτικό.</div>
  if (!poll) return <div className="text-gray-500">Η ψηφοφορία δεν βρέθηκε.</div>

  const results = poll.results ?? tallyVotes(votes, poll.options.length)
  const denom = poll.totalWeight || results.votedWeight || 1
  const participation = Math.round((results.votedWeight / (poll.totalWeight || 1)) * 100)
  const maxW = Math.max(0, ...Object.values(results.byOption))
  const winners = poll.options
    .map((o, i) => ({ o, i, w: results.byOption[i] ?? 0 }))
    .filter((x) => x.w > 0 && x.w === maxW)
  const sortedVotes = [...votes].sort((a, b) => {
    const ta = a.createdAt?.toMillis?.() ?? 0
    const tb = b.createdAt?.toMillis?.() ?? 0
    return ta - tb
  })

  return (
    <div className="mx-auto max-w-2xl">
      <div className="no-print mb-4 flex items-center justify-between">
        <Button variant="ghost" onClick={() => navigate(`/polls/${poll.id}`)}>
          <ArrowLeft size={18} /> Πίσω
        </Button>
        <Button variant="secondary" onClick={() => window.print()}>
          <Printer size={18} /> Εκτύπωση
        </Button>
      </div>

      <div className="print-area rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-900 shadow-sm">
        <div className="mb-4 border-b border-gray-300 pb-2 text-center">
          <h1 className="text-base font-bold tracking-wide">ΠΡΑΚΤΙΚΟ ΗΛΕΚΤΡΟΝΙΚΗΣ ΨΗΦΟΦΟΡΙΑΣ</h1>
          {building && (
            <div className="mt-1 text-xs text-gray-600">
              {building.name}{building.address ? ` — ${building.address}` : ''}
            </div>
          )}
        </div>

        <div className="space-y-1">
          <div><span className="text-gray-500">Θέμα:</span> <b>{poll.question}</b></div>
          {poll.description && <div className="text-gray-700">{poll.description}</div>}
          <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
            <div><span className="text-gray-500">Δικαίωμα ψήφου:</span> {poll.eligibility === 'owners' ? 'Ιδιοκτήτες' : 'Όλοι οι ένοικοι'}</div>
            <div><span className="text-gray-500">Βαρύτητα:</span> {POLL_WEIGHT_LABELS[poll.weightMode]}</div>
            <div><span className="text-gray-500">Ημ/νία δημιουργίας:</span> {formatDate(poll.createdAt)}</div>
            <div><span className="text-gray-500">Προθεσμία:</span> {poll.deadline ? formatDate(poll.deadline) : '—'}</div>
            <div><span className="text-gray-500">Κατάσταση:</span> {poll.status === 'closed' ? 'Κλειστή (ολοκληρωμένη)' : poll.status === 'open' ? 'Ανοιχτή' : 'Πρόχειρη'}</div>
            <div><span className="text-gray-500">Σύνολο δικαιώματος:</span> {mille(poll.totalWeight)}</div>
          </div>
        </div>

        {/* Αποτέλεσμα */}
        <h2 className="mb-2 mt-5 border-b border-gray-200 pb-1 text-sm font-bold">Αποτέλεσμα</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs text-gray-500">
              <th className="py-1">Επιλογή</th>
              <th className="py-1 text-right">Βάρος</th>
              <th className="py-1 text-right">Ποσοστό</th>
            </tr>
          </thead>
          <tbody>
            {poll.options.map((opt, i) => {
              const w = results.byOption[i] ?? 0
              const pct = denom ? Math.round((w / denom) * 100) : 0
              const win = winners.some((x) => x.i === i)
              return (
                <tr key={i} className="border-b border-gray-100">
                  <td className={`py-1 ${win ? 'font-bold' : ''}`}>{opt}{win ? ' ✓' : ''}</td>
                  <td className="py-1 text-right tnum">{mille(w)}</td>
                  <td className="py-1 text-right tnum">{pct}%</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <div className="mt-2 text-xs text-gray-600">
          Ψήφισαν: {results.votersCount} · Συμμετοχή: {participation}% του δικαιώματος ({mille(results.votedWeight)}/{mille(poll.totalWeight)})
        </div>
        <div className="mt-1 text-sm">
          <span className="text-gray-500">Απόφαση:</span>{' '}
          <b>
            {winners.length === 0
              ? 'Δεν υποβλήθηκαν ψήφοι'
              : winners.length === 1
              ? winners[0].o
              : `Ισοψηφία (${winners.map((x) => x.o).join(', ')})`}
          </b>
        </div>

        {/* Αναλυτικές ψήφοι */}
        <h2 className="mb-2 mt-5 border-b border-gray-200 pb-1 text-sm font-bold">Αναλυτικά ψηφισάντων</h2>
        {sortedVotes.length === 0 ? (
          <p className="text-sm text-gray-500">Δεν υποβλήθηκαν ψήφοι.</p>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-500">
                <th className="py-1">Α/Α</th>
                <th className="py-1">Ψηφοφόρος</th>
                <th className="py-1">Διαμέρισμα</th>
                <th className="py-1">Ψήφος</th>
                <th className="py-1 text-right">Βάρος</th>
                <th className="py-1">Ημ/νία & ώρα</th>
                <th className="py-1">IP</th>
              </tr>
            </thead>
            <tbody>
              {sortedVotes.map((v, idx) => (
                <tr key={v.id} className="border-b border-gray-100">
                  <td className="py-1">{idx + 1}</td>
                  <td className="py-1">{v.voterName || v.voterId}</td>
                  <td className="py-1">{(v.apartmentIds ?? []).map((aid) => aptCode.get(aid) ?? aid).join(', ')}</td>
                  <td className="py-1">{poll.options[v.option] ?? '—'}</td>
                  <td className="py-1 text-right tnum">{mille(v.weight)}</td>
                  <td className="py-1">{formatDateTime(v.createdAt)}</td>
                  <td className="py-1 text-gray-500">{v.meta?.ip ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="mt-6 text-xs text-gray-500">
          Το παρόν πρακτικό παράγεται αυτόματα από την πλατφόρμα διαχείρισης. Εκτύπωση: {formatDateTime(new Date())}
          {building?.managerName ? ` · Διαχειριστής: ${building.managerName}` : ''}
        </div>

        <Footer className="print-only mt-3 border-t border-gray-100" />
      </div>
    </div>
  )
}
