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
import type { ContactEntry } from '@/types'

export async function listContacts(buildingId: string): Promise<ContactEntry[]> {
  const snap = await getDocs(query(col('contacts'), where('buildingId', '==', buildingId)))
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ContactEntry, 'id'>) }))
}

export async function createContact(data: Omit<ContactEntry, 'id'>): Promise<string> {
  const ref = await addDoc(col('contacts'), {
    ...clean(data),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return ref.id
}

export async function updateContact(id: string, patch: Partial<ContactEntry>): Promise<void> {
  await updateDoc(doc(requireDb(), 'contacts', id), { ...clean(patch), updatedAt: serverTimestamp() })
}

export async function deleteContact(id: string): Promise<void> {
  await deleteDoc(doc(requireDb(), 'contacts', id))
}
