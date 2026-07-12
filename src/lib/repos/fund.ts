import {
  addDoc,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  where,
} from 'firebase/firestore'
import { col, clean, requireDb } from '../db'
import type { FundEntry } from '@/types'

export async function listFundEntries(buildingId: string): Promise<FundEntry[]> {
  const snap = await getDocs(query(col('fundEntries'), where('buildingId', '==', buildingId)))
  const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<FundEntry, 'id'>) }))
  return rows.sort((a, b) => {
    const ta = a.date?.toMillis?.() ?? 0
    const tb = b.date?.toMillis?.() ?? 0
    return tb - ta
  })
}

export async function createFundEntry(data: Omit<FundEntry, 'id'>): Promise<string> {
  const ref = await addDoc(col('fundEntries'), {
    ...clean(data),
    createdAt: serverTimestamp(),
  })
  return ref.id
}

export async function deleteFundEntry(id: string): Promise<void> {
  await deleteDoc(doc(requireDb(), 'fundEntries', id))
}

/** Running balance = Σ(in) − Σ(out). */
export function fundBalance(entries: FundEntry[]): number {
  return entries.reduce((s, e) => s + (e.type === 'in' ? e.amount : -e.amount), 0)
}
