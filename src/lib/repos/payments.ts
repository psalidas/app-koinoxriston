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
import type { Payment } from '@/types'

export async function listPayments(
  buildingId: string,
  apartmentId?: string,
): Promise<Payment[]> {
  const clauses = [where('buildingId', '==', buildingId)]
  if (apartmentId) clauses.push(where('apartmentId', '==', apartmentId))
  const snap = await getDocs(query(col('payments'), ...clauses))
  const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Payment, 'id'>) }))
  return rows.sort((a, b) => {
    const ta = a.date?.toMillis?.() ?? 0
    const tb = b.date?.toMillis?.() ?? 0
    return tb - ta
  })
}

export async function createPayment(data: Omit<Payment, 'id'>): Promise<string> {
  const ref = await addDoc(col('payments'), {
    ...clean(data),
    createdAt: serverTimestamp(),
  })
  return ref.id
}

export async function deletePayment(id: string): Promise<void> {
  await deleteDoc(doc(requireDb(), 'payments', id))
}
