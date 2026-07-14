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
import type { WorkTask } from '@/types'

export async function listWorks(buildingId: string): Promise<WorkTask[]> {
  const snap = await getDocs(query(col('works'), where('buildingId', '==', buildingId)))
  const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<WorkTask, 'id'>) }))
  return rows.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0))
}

export async function createWork(data: Omit<WorkTask, 'id'>): Promise<string> {
  const ref = await addDoc(col('works'), {
    ...clean(data),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return ref.id
}

export async function updateWork(id: string, patch: Partial<WorkTask>): Promise<void> {
  await updateDoc(doc(requireDb(), 'works', id), { ...clean(patch), updatedAt: serverTimestamp() })
}

export async function deleteWork(id: string): Promise<void> {
  await deleteDoc(doc(requireDb(), 'works', id))
}
