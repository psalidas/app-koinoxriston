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
import type { Contract } from '@/types'

export async function listContracts(buildingId: string): Promise<Contract[]> {
  const snap = await getDocs(query(col('contracts'), where('buildingId', '==', buildingId)))
  const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Contract, 'id'>) }))
  return rows.sort((a, b) => (a.endDate?.toMillis?.() ?? Infinity) - (b.endDate?.toMillis?.() ?? Infinity))
}

export async function createContract(data: Omit<Contract, 'id'>): Promise<string> {
  const ref = await addDoc(col('contracts'), { ...clean(data), createdAt: serverTimestamp() })
  return ref.id
}

export async function updateContract(id: string, patch: Partial<Contract>): Promise<void> {
  await updateDoc(doc(requireDb(), 'contracts', id), clean(patch))
}

export async function deleteContract(id: string): Promise<void> {
  await deleteDoc(doc(requireDb(), 'contracts', id))
}

/** Days until expiry (negative = expired). null if no end date. */
export function daysUntil(c: Contract): number | null {
  const ms = c.endDate?.toMillis?.()
  if (!ms) return null
  return Math.ceil((ms - Date.now()) / 86_400_000)
}
