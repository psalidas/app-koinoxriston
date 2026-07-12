import { doc, getDoc, getDocs, setDoc, updateDoc } from 'firebase/firestore'
import { col, clean, requireDb } from '../db'
import type { Building } from '@/types'

export async function listBuildings(): Promise<Building[]> {
  const snap = await getDocs(col('buildings'))
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Building, 'id'>) }))
}

export async function getBuilding(id: string): Promise<Building | null> {
  const snap = await getDoc(doc(requireDb(), 'buildings', id))
  if (!snap.exists()) return null
  return { id: snap.id, ...(snap.data() as Omit<Building, 'id'>) }
}

export async function saveBuilding(id: string, data: Omit<Building, 'id'>): Promise<void> {
  await setDoc(doc(requireDb(), 'buildings', id), clean(data), { merge: true })
}

export async function updateBuilding(
  id: string,
  patch: Partial<Building>,
): Promise<void> {
  await updateDoc(doc(requireDb(), 'buildings', id), clean(patch))
}
