import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { col, clean, requireDb } from '../db'
import type { Expense } from '@/types'

export async function listExpenses(
  buildingId: string,
  period?: string,
): Promise<Expense[]> {
  const clauses = [where('buildingId', '==', buildingId)]
  if (period) clauses.push(where('period', '==', period))
  const snap = await getDocs(query(col('expenses'), ...clauses))
  const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Expense, 'id'>) }))
  return rows.sort((a, b) => (a.period < b.period ? 1 : a.period > b.period ? -1 : 0))
}

/**
 * Δημιουργεί δαπάνη με αύξοντα κωδικό «Δ-NNNN» ανά κτίριο (counter σε
 * transaction ώστε να μη διπλασιάζεται σε ταυτόχρονες εγγραφές).
 */
export async function createExpense(data: Omit<Expense, 'id'>): Promise<string> {
  const db = requireDb()
  const counterRef = doc(db, 'counters', data.buildingId)
  const expRef = doc(collection(db, 'expenses'))
  await runTransaction(db, async (tx) => {
    const cs = await tx.get(counterRef)
    const seq = (((cs.exists() ? (cs.data().expenseSeq as number) : 0) || 0) as number) + 1
    const code = `Δ-${String(seq).padStart(4, '0')}`
    tx.set(counterRef, { expenseSeq: seq }, { merge: true })
    tx.set(expRef, { ...clean(data), code, createdAt: serverTimestamp() })
  })
  return expRef.id
}

export async function updateExpense(id: string, patch: Partial<Expense>): Promise<void> {
  await updateDoc(doc(requireDb(), 'expenses', id), clean(patch))
}

export async function deleteExpense(id: string): Promise<void> {
  await deleteDoc(doc(requireDb(), 'expenses', id))
}
