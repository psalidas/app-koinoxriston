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

export async function createExpense(data: Omit<Expense, 'id'>): Promise<string> {
  const ref = await addDoc(col('expenses'), {
    ...clean(data),
    createdAt: serverTimestamp(),
  })
  return ref.id
}

export async function updateExpense(id: string, patch: Partial<Expense>): Promise<void> {
  await updateDoc(doc(requireDb(), 'expenses', id), clean(patch))
}

export async function deleteExpense(id: string): Promise<void> {
  await deleteDoc(doc(requireDb(), 'expenses', id))
}
