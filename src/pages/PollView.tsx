import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Lock, Trash2 } from 'lucide-react'
import { useAppData } from '@/lib/appData'
import { useAuth } from '@/lib/auth'
import { Button, Card, Badge } from '@/components/forms'
import { mille, formatDate } from '@/lib/format'
import type { Poll, Vote } from '@/types'
import { POLL_WEIGHT_LABELS } from '@/types'
import {
  getPoll,
  updatePoll,
  deletePoll,
  getMyVote,
  castVote,
  listVotes,
  voterWeight,
  tallyVotes,
} from '@/lib/repos/polls'
import { logAudit } from '@/lib/audit'

export default function PollView() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { building, apartments } = useAppData()
  const { isManager, user, profile } = useAuth()
  const [poll, setPoll] = useState<Poll | null>(null)
  const [myVote, setMyVote] = useState<Vote | null>(null)
  const [choice, setChoice] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)

  const voterId = user?.email ?? user?.phoneNumber ?? ''
  const myApartments = useMemo(
    () => apartments.filter((a) => (profile?.apartmentIds ?? []).includes(a.id)),
    [apartments, profile],
  )

  async function load() {
    if (!id) return
    const p = await getPoll(id)
    setPoll(p)
    if (voterId) {
      const v = await getMyVote(id, voterId)
      setMyVote(v)
      if (v) setChoice(v.option)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, voterId])

  if (!poll) return <div className="text-gray-400">Φόρτωση…</div>

  const myWeight = voterWeight(myApartments, poll.weightMode, poll.scaleKey)
  const eligible = myApartments.length > 0 && myWeight > 0
  const open = poll.status === 'open'

  async function submitVote() {
    if (!building || !poll || choice === null || !voterId) return
    setBusy(true)
    try {
      await castVote({
        buildingId: building.id,
        pollId: poll.id,
        voterId,
        voterName: profile?.name ?? voterId,
        option: choice,
        weight: myWeight,
        apartmentIds: myApartments.map((a) => a.id),
      })
      await logAudit({
        buildingId: building.id,
        userEmail: voterId,
        userName: profile?.name ?? voterId,
        action: 'vote',
        entity: 'poll',
        entityId: poll.question,
      })
      await load()
    } finally {
      setBusy(false)
    }
  }

  async function closeAndPublish() {
    if (!poll) return
    setBusy(true)
    try {
      const votes = await listVotes(poll.id)
      const results = tallyVotes(votes, poll.options.length)
      await updatePoll(poll.id, { status: 'closed', results })
      await load()
    } finally {
      setBusy(false)
    }
  }

  async function reopen() {
    if (!poll) return
    await updatePoll(poll.id, { status: 'open' })
    await load()
  }

  async function remove() {
    if (!poll) return
    await deletePoll(poll.id)
    navigate('/polls')
  }

  const results = poll.results
  const denom = poll.totalWeight || results?.votedWeight || 1
  const participation = results ? Math.round((results.votedWeight / (poll.totalWeight || 1)) * 100) : 0

  return (
    <div className="mx-auto max-w-2xl">
      <button
        onClick={() => navigate('/polls')}
        className="mb-3 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft size={16} /> Ψηφοφορίες
      </button>

      <Card>
        <div className="flex items-start justify-between gap-2">
          <h1 className="text-lg font-semibold text-gray-900">{poll.question}</h1>
          <Badge color={open ? 'green' : 'gray'}>{open ? 'Ανοιχτή' : 'Κλειστή'}</Badge>
        </div>
        {poll.description && <p className="mt-1 text-sm text-gray-600">{poll.description}</p>}
        <div className="mt-2 text-xs text-gray-400">
          {POLL_WEIGHT_LABELS[poll.weightMode]}
          {poll.deadline && ` · λήξη ${formatDate(poll.deadline)}`}
          {' · '}δικαίωμα: {poll.eligibility === 'owners' ? 'ιδιοκτήτες' : 'ένοικοι'}
        </div>
      </Card>

      {/* Voting / results */}
      <Card className="mt-4">
        {results ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold text-gray-700">Αποτελέσματα</span>
              <span className="text-gray-500">Συμμετοχή {participation}%</span>
            </div>
            {poll.options.map((opt, i) => {
              const w = results.byOption[i] ?? 0
              const pct = denom ? Math.round((w / denom) * 100) : 0
              const winner = w === Math.max(...Object.values(results.byOption))
              return (
                <div key={i}>
                  <div className="mb-0.5 flex items-center justify-between text-sm">
                    <span className={winner ? 'font-semibold text-gray-900' : 'text-gray-700'}>{opt}</span>
                    <span className="tnum text-gray-500">
                      {mille(w)} ({pct}%)
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                    <div
                      className={`h-full rounded-full ${winner ? 'bg-blue-600' : 'bg-blue-300'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
            <p className="text-xs text-gray-400">
              Σύνολο δικαιώματος: {mille(poll.totalWeight)} · ψήφισαν {results.votersCount}
            </p>
          </div>
        ) : eligible ? (
          <div className="space-y-2">
            <div className="text-sm font-medium text-gray-700">
              Η ψήφος σας {poll.weightMode !== 'perUser' && `(βάρος ${mille(myWeight)})`}
            </div>
            {poll.options.map((opt, i) => (
              <label
                key={i}
                className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm ${
                  choice === i ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                } ${!open ? 'opacity-60' : ''}`}
              >
                <input
                  type="radio"
                  name="vote"
                  disabled={!open}
                  checked={choice === i}
                  onChange={() => setChoice(i)}
                />
                {opt}
              </label>
            ))}
            {open && (
              <Button onClick={submitVote} disabled={busy || choice === null} className="mt-2 w-full">
                <CheckCircle2 size={18} /> {myVote ? 'Αλλαγή ψήφου' : 'Υποβολή ψήφου'}
              </Button>
            )}
            {myVote && (
              <p className="text-center text-xs text-green-600">
                Έχετε ψηφίσει: {poll.options[myVote.option]}
              </p>
            )}
          </div>
        ) : (
          <p className="py-2 text-center text-sm text-gray-500">
            Δεν έχετε δικαίωμα ψήφου σε αυτή την ψηφοφορία (δεν υπάρχει συνδεδεμένο διαμέρισμα).
          </p>
        )}
      </Card>

      {isManager && (
        <div className="mt-4 flex justify-end gap-2">
          {open ? (
            <Button onClick={closeAndPublish} disabled={busy}>
              <Lock size={18} /> Κλείσιμο & δημοσίευση
            </Button>
          ) : (
            <Button variant="secondary" onClick={reopen}>
              Επαναφορά σε ανοιχτή
            </Button>
          )}
          <Button variant="danger" onClick={remove}>
            <Trash2 size={18} /> Διαγραφή
          </Button>
        </div>
      )}
    </div>
  )
}
