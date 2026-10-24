import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { deleteField } from 'firebase/firestore'
import { ArrowLeft, CheckCircle2, Lock, Trash2, Paperclip, Pencil, Send, FileText, Info } from 'lucide-react'
import { useAppData } from '@/lib/appData'
import { useAuth } from '@/lib/auth'
import { Button, Card, Badge } from '@/components/forms'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { PollFormModal } from '@/components/PollFormModal'
import { mille, formatDate, formatDateTime } from '@/lib/format'
import type { Poll, Vote } from '@/types'
import { POLL_WEIGHT_LABELS } from '@/types'
import {
  getPoll,
  updatePoll,
  deletePoll,
  getMyVote,
  submitVote as castVoteRemote,
  listVotes,
  deleteVote,
  voterWeight,
  tallyVotes,
} from '@/lib/repos/polls'

export default function PollView() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { building, apartments } = useAppData()
  const { isManager, user, profile } = useAuth()
  const [poll, setPoll] = useState<Poll | null>(null)
  const [myVote, setMyVote] = useState<Vote | null>(null)
  const [choice, setChoice] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [votes, setVotes] = useState<Vote[]>([])
  const [voteToDelete, setVoteToDelete] = useState<Vote | null>(null)
  const [expandedVote, setExpandedVote] = useState<string | null>(null)
  const [showNotVoted, setShowNotVoted] = useState(false)

  const voterId = user?.email ?? user?.phoneNumber ?? ''
  const myApartments = useMemo(
    () => apartments.filter((a) => (profile?.apartmentIds ?? []).includes(a.id)),
    [apartments, profile],
  )

  // Ζωντανή σύνοψη για τον διαχειριστή (χιλιοστά & ποσοστά ανά επιλογή + μη ψηφίσαντες).
  const tally = useMemo(() => {
    if (!poll) return null
    const totalW = poll.totalWeight || 0
    const byOption = poll.options.map((_, i) => {
      const vs = votes.filter((v) => v.option === i)
      const w = vs.reduce((s, v) => s + v.weight, 0)
      return { weight: w, count: vs.length, pct: totalW ? Math.round((w / totalW) * 100) : 0 }
    })
    const votedW = votes.reduce((s, v) => s + v.weight, 0)
    const votedApt = new Set(votes.flatMap((v) => v.apartmentIds ?? []))
    const scaleKey = poll.scaleKey || 'genika'
    const eligibleApts = apartments.filter((a) =>
      poll.weightMode === 'millesime' ? (a.millesimes[scaleKey] ?? 0) > 0 : true,
    )
    const notVoted = eligibleApts.filter((a) => !votedApt.has(a.id))
    return {
      totalW,
      byOption,
      votedW,
      remainingW: Math.max(0, totalW - votedW),
      votedCount: votes.length,
      eligibleCount: eligibleApts.length,
      notVoted,
      pct: totalW ? Math.round((votedW / totalW) * 100) : 0,
    }
  }, [poll, votes, apartments])

  async function load() {
    if (!id) return
    const p = await getPoll(id)
    setPoll(p)
    if (voterId) {
      const v = await getMyVote(id, voterId)
      setMyVote(v)
      if (v) setChoice(v.option)
    }
    if (isManager) {
      setVotes(await listVotes(id))
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
  const isDraft = poll.status === 'draft'
  const statusBadge = open
    ? { color: 'green' as const, label: 'Ανοιχτή' }
    : isDraft
    ? { color: 'amber' as const, label: 'Πρόχειρη' }
    : { color: 'gray' as const, label: 'Κλειστή' }

  async function submitVote() {
    if (!poll || choice === null) return
    setBusy(true)
    try {
      await castVoteRemote(poll.id, choice)
      await load()
    } catch (e) {
      alert('Αποτυχία ψήφου: ' + ((e as Error).message || 'άγνωστο'))
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
    // Καθάρισε τα παλιά αποτελέσματα ώστε να ξαναγίνει ορατή η ψήφος.
    await updatePoll(poll.id, { status: 'open', results: deleteField() as unknown as undefined })
    await load()
  }

  async function publish() {
    if (!poll) return
    await updatePoll(poll.id, { status: 'open' })
    await load()
  }

  async function remove() {
    if (!poll) return
    await deletePoll(poll.id)
    navigate('/polls')
  }

  async function confirmDeleteVote() {
    if (!poll || !voteToDelete) return
    await deleteVote(poll.id, voteToDelete.voterId)
    setVoteToDelete(null)
    await load()
  }

  // Κωδικοί διαμερισμάτων ανά id (για τη λίστα ψήφων).
  const aptCode = new Map(apartments.map((a) => [a.id, a.code]))

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
          <Badge color={statusBadge.color}>{statusBadge.label}</Badge>
        </div>
        {poll.description && <p className="mt-1 text-sm text-gray-600">{poll.description}</p>}
        {poll.attachments && poll.attachments.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {poll.attachments.map((f, i) =>
              (f.contentType ?? '').startsWith('image/') || /\.(png|jpe?g|gif|webp)$/i.test(f.name) ? (
                <a key={i} href={f.url} target="_blank" rel="noreferrer" title={f.name}>
                  <img src={f.url} alt={f.name} className="h-20 w-20 rounded-md border border-gray-200 object-cover hover:opacity-90" />
                </a>
              ) : (
                <a
                  key={i}
                  href={f.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex max-w-[12rem] items-center gap-1.5 rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-xs text-gray-700 hover:border-blue-300 hover:text-blue-700"
                >
                  <Paperclip size={13} className="shrink-0" />
                  <span className="truncate">{f.name}</span>
                </a>
              ),
            )}
          </div>
        )}
        <div className="mt-2 text-xs text-gray-400">
          {POLL_WEIGHT_LABELS[poll.weightMode]}
          {poll.deadline && ` · λήξη ${formatDate(poll.deadline)}`}
          {' · '}δικαίωμα: {poll.eligibility === 'owners' ? 'ιδιοκτήτες' : 'ένοικοι'}
        </div>
      </Card>

      {/* Voting / results */}
      <Card className="mt-4">
        {isDraft ? (
          <p className="py-3 text-center text-sm text-amber-700">
            Πρόχειρη ψηφοφορία (δοκιμή) — δεν έχει δημοσιευτεί ακόμη, δεν επιτρέπεται ψήφος.
          </p>
        ) : poll.status === 'closed' && results ? (
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
          myVote ? (
            <div className="space-y-1 text-sm">
              <div className="font-medium text-gray-700">Η ψήφος σας</div>
              <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2">
                <CheckCircle2 size={18} className="text-green-600" />
                <span className="text-gray-800">{poll.options[myVote.option]}</span>
              </div>
              <p className="text-xs text-gray-400">
                Η ψήφος είναι οριστική και δεν αλλάζει. Αν χρειάζεται διόρθωση, ζητήστε από τον
                διαχειριστή να τη διαγράψει για να ξαναψηφίσετε.
              </p>
            </div>
          ) : (
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
              {open ? (
                <Button onClick={submitVote} disabled={busy || choice === null} className="mt-2 w-full">
                  <CheckCircle2 size={18} /> Υποβολή ψήφου
                </Button>
              ) : (
                <p className="text-center text-xs text-gray-400">Η ψηφοφορία δεν είναι ανοιχτή.</p>
              )}
            </div>
          )
        ) : (
          <p className="py-2 text-center text-sm text-gray-500">
            Δεν έχετε δικαίωμα ψήφου σε αυτή την ψηφοφορία (δεν υπάρχει συνδεδεμένο διαμέρισμα).
          </p>
        )}
      </Card>

      {isManager && (
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={() => setEditOpen(true)}>
            <Pencil size={18} /> Επεξεργασία
          </Button>
          {poll.status === 'closed' && (
            <Button variant="secondary" onClick={() => navigate(`/polls/${poll.id}/minutes`)}>
              <FileText size={18} /> Πρακτικό
            </Button>
          )}
          {isDraft && (
            <Button onClick={publish} disabled={busy}>
              <Send size={18} /> Δημοσίευση
            </Button>
          )}
          {open && (
            <Button onClick={closeAndPublish} disabled={busy}>
              <Lock size={18} /> Κλείσιμο & δημοσίευση
            </Button>
          )}
          {poll.status === 'closed' && (
            <Button variant="secondary" onClick={reopen}>
              Επαναφορά σε ανοιχτή
            </Button>
          )}
          <Button variant="danger" onClick={remove}>
            <Trash2 size={18} /> Διαγραφή
          </Button>
        </div>
      )}

      {isManager && tally && (
        <Card className="mt-4">
          <h2 className="mb-2 text-sm font-semibold text-gray-700">Σύνοψη (ζωντανά)</h2>
          <div className="space-y-2">
            {poll.options.map((opt, i) => {
              const t = tally.byOption[i]
              return (
                <div key={i}>
                  <div className="mb-0.5 flex items-center justify-between text-sm">
                    <span className="text-gray-800">{opt}</span>
                    <span className="tnum text-gray-500">
                      {mille(t.weight)} χιλ. ({t.pct}%) · {t.count} {t.count === 1 ? 'ψήφος' : 'ψήφοι'}
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                    <div className="h-full rounded-full bg-blue-400" style={{ width: `${t.pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
            <div className="rounded-md bg-gray-50 p-2">
              <div className="text-gray-500">Σύνολο δικαιώματος</div>
              <div className="tnum font-semibold">{mille(tally.totalW)} χιλ.</div>
            </div>
            <div className="rounded-md bg-gray-50 p-2">
              <div className="text-gray-500">Ψήφισαν</div>
              <div className="tnum font-semibold">{mille(tally.votedW)} χιλ. ({tally.pct}%)</div>
              <div className="text-gray-400">{tally.votedCount} ψηφοφόροι</div>
            </div>
            <div className="rounded-md bg-gray-50 p-2">
              <div className="text-gray-500">Δεν ψήφισαν</div>
              <div className="tnum font-semibold">{mille(tally.remainingW)} χιλ.</div>
              <div className="text-gray-400">{tally.notVoted.length} διαμερίσματα</div>
            </div>
          </div>
          {tally.notVoted.length > 0 && (
            <div className="mt-2">
              <button
                onClick={() => setShowNotVoted((v) => !v)}
                className="text-xs text-blue-600 hover:underline"
              >
                {showNotVoted ? 'Απόκρυψη' : 'Εμφάνιση'} όσων δεν έχουν ψηφίσει ({tally.notVoted.length})
              </button>
              {showNotVoted && (
                <ul className="mt-1 flex flex-wrap gap-1.5">
                  {[...tally.notVoted]
                    .sort((a, b) => a.orderNo - b.orderNo)
                    .map((a) => (
                      <li key={a.id} className="rounded-md bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                        {a.code}{a.ownerName ? ` — ${a.ownerName}` : ''}
                      </li>
                    ))}
                </ul>
              )}
            </div>
          )}
        </Card>
      )}

      {isManager && (
        <Card className="mt-4">
          <h2 className="mb-2 text-sm font-semibold text-gray-700">
            Ψήφοι ({votes.length})
          </h2>
          {votes.length === 0 ? (
            <p className="py-2 text-center text-sm text-gray-400">Κανείς δεν έχει ψηφίσει ακόμη.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {[...votes]
                .sort((a, b) => (a.voterName || a.voterId).localeCompare(b.voterName || b.voterId, 'el'))
                .map((v) => (
                  <li key={v.id} className="py-2 text-sm">
                    <div className="flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-gray-900">{v.voterName || v.voterId}</div>
                        <div className="text-xs text-gray-500">
                          {(v.apartmentIds ?? []).map((aid) => aptCode.get(aid) ?? aid).join(', ')}
                          {' · '}
                          <span className="text-gray-700">{poll.options[v.option] ?? '—'}</span>
                          {poll.weightMode !== 'perUser' && ` · βάρος ${mille(v.weight)}`}
                          {v.createdAt && ` · ${formatDateTime(v.createdAt)}`}
                        </div>
                      </div>
                      <button
                        onClick={() => setExpandedVote(expandedVote === v.id ? null : v.id)}
                        className="shrink-0 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-blue-600"
                        title="Λεπτομέρειες"
                      >
                        <Info size={16} />
                      </button>
                      <button
                        onClick={() => setVoteToDelete(v)}
                        className="shrink-0 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-red-600"
                        title="Διαγραφή ψήφου (για επαναψήφιση)"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    {expandedVote === v.id && (
                      <div className="mt-1 rounded-md bg-gray-50 p-2 text-xs text-gray-600">
                        <div><span className="text-gray-400">Ημ/νία & ώρα:</span> {formatDateTime(v.createdAt)}</div>
                        <div><span className="text-gray-400">Ταυτότητα:</span> {v.voterId}</div>
                        {v.meta?.ip && <div><span className="text-gray-400">IP:</span> {v.meta.ip}</div>}
                        {v.meta?.userAgent && <div className="break-words"><span className="text-gray-400">Browser:</span> {v.meta.userAgent}</div>}
                        {v.meta?.platform && <div><span className="text-gray-400">Σύστημα:</span> {v.meta.platform}</div>}
                        {v.meta?.timezone && <div><span className="text-gray-400">Ζώνη ώρας:</span> {v.meta.timezone}</div>}
                        {v.meta?.screen && <div><span className="text-gray-400">Οθόνη:</span> {v.meta.screen}</div>}
                        {!v.meta && <div className="text-gray-400">Χωρίς μεταδεδομένα (παλαιότερη ψήφος).</div>}
                      </div>
                    )}
                  </li>
                ))}
            </ul>
          )}
        </Card>
      )}

      {building && (
        <PollFormModal
          open={editOpen}
          onClose={() => setEditOpen(false)}
          building={building}
          apartments={apartments}
          poll={poll}
          onSaved={load}
        />
      )}

      <ConfirmDialog
        open={!!voteToDelete}
        message={`Διαγραφή της ψήφου «${voteToDelete?.voterName || voteToDelete?.voterId}»; Το διαμέρισμα θα μπορεί να ξαναψηφίσει.`}
        onCancel={() => setVoteToDelete(null)}
        onConfirm={confirmDeleteVote}
      />
    </div>
  )
}
