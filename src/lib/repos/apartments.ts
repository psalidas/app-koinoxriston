import {
  addDoc,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore'
import { col, clean, requireDb } from '../db'
import { compareEl } from '../format'
import type { Apartment } from '@/types'

export async function listApartments(buildingId: string): Promise<Apartment[]> {
  const snap = await getDocs(query(col('apartments'), where('buildingId', '==', buildingId)))
  const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Apartment, 'id'>) }))
  return rows.sort((a, b) => a.orderNo - b.orderNo || compareEl(a.code, b.code))
}

export async function createApartment(data: Omit<Apartment, 'id'>): Promise<string> {
  const ref = await addDoc(col('apartments'), {
    ...clean(data),
    createdAt: serverTimestamp(),
  })
  return ref.id
}

/** Create with a specific id (used by seeding). */
export async function setApartment(id: string, data: Omit<Apartment, 'id'>): Promise<void> {
  await setDoc(doc(requireDb(), 'apartments', id), clean(data), { merge: true })
}

export async function updateApartment(id: string, patch: Partial<Apartment>): Promise<void> {
  await updateDoc(doc(requireDb(), 'apartments', id), clean(patch))
}

export async function deleteApartment(id: string): Promise<void> {
  await deleteDoc(doc(requireDb(), 'apartments', id))
}

/** Bulk-update millesimes for many apartments (πίνακας χιλιοστών). */
export async function updateMillesimes(
  updates: { id: string; millesimes: Record<string, number> }[],
): Promise<void> {
  await Promise.all(
    updates.map((u) =>
      updateDoc(doc(requireDb(), 'apartments', u.id), { millesimes: u.millesimes }),
    ),
  )
}
