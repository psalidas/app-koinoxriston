import {
  addDoc,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { col, clean, requireDb } from '../db'
import type { Assembly } from '@/types'

export async function listAssemblies(buildingId: string): Promise<Assembly[]> {
  const snap = await getDocs(query(col('assemblies'), where('buildingId', '==', buildingId)))
  const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Assembly, 'id'>) }))
  return rows.sort((a, b) => (b.scheduledAt?.toMillis?.() ?? 0) - (a.scheduledAt?.toMillis?.() ?? 0))
}

export async function getAssembly(id: string): Promise<Assembly | null> {
  const snap = await getDoc(doc(requireDb(), 'assemblies', id))
  if (!snap.exists()) return null
  return { id: snap.id, ...(snap.data() as Omit<Assembly, 'id'>) }
}

export async function createAssembly(data: Omit<Assembly, 'id'>): Promise<string> {
  const ref = await addDoc(col('assemblies'), { ...clean(data), createdAt: serverTimestamp() })
  return ref.id
}

export async function updateAssembly(id: string, patch: Partial<Assembly>): Promise<void> {
  await updateDoc(doc(requireDb(), 'assemblies', id), clean(patch))
}

export async function deleteAssembly(id: string): Promise<void> {
  await deleteDoc(doc(requireDb(), 'assemblies', id))
}
