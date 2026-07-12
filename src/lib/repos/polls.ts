import {
  addDoc,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore'
import { col, clean, requireDb } from '../db'
import type { Apartment, Poll, PollResults, PollWeightMode, Vote } from '@/types'

export async function listPolls(buildingId: string): Promise<Poll[]> {
  const snap = await getDocs(query(col('polls'), where('buildingId', '==', buildingId)))
  const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Poll, 'id'>) }))
  return rows.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0))
}

export async function getPoll(id: string): Promise<Poll | null> {
  const snap = await getDoc(doc(requireDb(), 'polls', id))
  if (!snap.exists()) return null
  return { id: snap.id, ...(snap.data() as Omit<Poll, 'id'>) }
}

export async function createPoll(data: Omit<Poll, 'id'>): Promise<string> {
  const ref = await addDoc(col('polls'), { ...clean(data), createdAt: serverTimestamp() })
  return ref.id
}

export async function updatePoll(id: string, patch: Partial<Poll>): Promise<void> {
  await updateDoc(doc(requireDb(), 'polls', id), clean(patch))
}

export async function deletePoll(id: string): Promise<void> {
  await deleteDoc(doc(requireDb(), 'polls', id))
}

// ── Votes ──
function voteId(pollId: string, voterId: string): string {
  return `${pollId}__${voterId}`
}

export async function getMyVote(pollId: string, voterId: string): Promise<Vote | null> {
  const snap = await getDoc(doc(requireDb(), 'votes', voteId(pollId, voterId)))
  if (!snap.exists()) return null
  return { id: snap.id, ...(snap.data() as Omit<Vote, 'id'>) }
}

export async function castVote(data: Omit<Vote, 'id'>): Promise<void> {
  await setDoc(doc(requireDb(), 'votes', voteId(data.pollId, data.voterId)), {
    ...clean(data),
    createdAt: serverTimestamp(),
  })
}

export async function listVotes(pollId: string): Promise<Vote[]> {
  const snap = await getDocs(query(col('votes'), where('pollId', '==', pollId)))
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Vote, 'id'>) }))
}

// ── Weight helpers ──
/** Compute a voter's weight for a poll from their apartments. */
export function voterWeight(
  apartments: Apartment[],
  mode: PollWeightMode,
  scaleKey?: string,
): number {
  if (mode === 'perUser') return apartments.length > 0 ? 1 : 0
  if (mode === 'perApartment') return apartments.length
  const key = scaleKey ?? 'genika'
  return apartments.reduce((s, a) => s + (a.millesimes[key] ?? 0), 0)
}

/** Total eligible weight across all apartments (quorum denominator). */
export function totalEligibleWeight(
  apartments: Apartment[],
  mode: PollWeightMode,
  scaleKey?: string,
): number {
  if (mode === 'perUser') return apartments.length
  if (mode === 'perApartment') return apartments.length
  const key = scaleKey ?? 'genika'
  return apartments.reduce((s, a) => s + (a.millesimes[key] ?? 0), 0)
}

export function tallyVotes(votes: Vote[], optionCount: number): PollResults {
  const byOption: Record<string, number> = {}
  for (let i = 0; i < optionCount; i++) byOption[i] = 0
  let votedWeight = 0
  for (const v of votes) {
    byOption[v.option] = (byOption[v.option] ?? 0) + v.weight
    votedWeight += v.weight
  }
  return { byOption, votedWeight, votersCount: votes.length }
}
