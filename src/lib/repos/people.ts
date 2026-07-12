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
import { compareEl } from '../format'
import type { Person } from '@/types'

export async function listPeople(buildingId: string): Promise<Person[]> {
  const snap = await getDocs(query(col('people'), where('buildingId', '==', buildingId)))
  const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Person, 'id'>) }))
  return rows.sort((a, b) => compareEl(a.name, b.name))
}

export async function createPerson(data: Omit<Person, 'id'>): Promise<string> {
  const ref = await addDoc(col('people'), {
    ...clean(data),
    createdAt: serverTimestamp(),
  })
  return ref.id
}

export async function updatePerson(id: string, patch: Partial<Person>): Promise<void> {
  await updateDoc(doc(requireDb(), 'people', id), clean(patch))
}

export async function deletePerson(id: string): Promise<void> {
  await deleteDoc(doc(requireDb(), 'people', id))
}
