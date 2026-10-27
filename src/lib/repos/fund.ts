import {
  addDoc,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { col, clean, requireDb } from '../db'
import type { Expense, FundEntry, Payment } from '@/types'

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

export async function updateFundEntry(id: string, patch: Partial<FundEntry>): Promise<void> {
  await updateDoc(doc(requireDb(), 'fundEntries', id), clean(patch))
}

export async function deleteFundEntry(id: string): Promise<void> {
  await deleteDoc(doc(requireDb(), 'fundEntries', id))
}

/** Υπόλοιπο χειροκίνητων κινήσεων = Σ(in) − Σ(out), αγνοώντας τις μεταφορές. */
export function fundBalance(entries: FundEntry[]): number {
  return entries.reduce((s, e) => (e.transfer ? s : s + (e.type === 'in' ? e.amount : -e.amount)), 0)
}

/** Σύνολα εισπράξεων/πληρωμών χειροκίνητων κινήσεων (χωρίς μεταφορές). */
export function fundEntryTotals(entries: FundEntry[]): { inSum: number; outSum: number } {
  let inSum = 0
  let outSum = 0
  for (const e of entries) {
    if (e.transfer) continue
    if (e.type === 'in') inSum += e.amount
    else outSum += e.amount
  }
  return { inSum, outSum }
}

/**
 * Πραγματικό υπόλοιπο ταμείου (πλήρης ταμειακή ροή):
 * Πληρωμές ενοίκων − Δαπάνες + κινήσεις Ταμείου (in − out, χωρίς μεταφορές).
 */
export function cashBalance(payments: Payment[], expenses: Expense[], entries: FundEntry[]): number {
  const pay = payments.reduce((s, p) => s + (p.amount || 0), 0)
  const exp = expenses.reduce((s, e) => s + (e.amount || 0), 0)
  const { inSum, outSum } = fundEntryTotals(entries)
  return pay - exp + inSum - outSum
}
