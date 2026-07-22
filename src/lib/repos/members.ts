import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore'
import { clean, requireDb } from '../db'
import type { Member } from '@/types'

/** Μέλη ενός κτιρίου: /buildings/{buildingId}/members/{userId}. */
export async function listMembers(buildingId: string): Promise<Member[]> {
  const snap = await getDocs(collection(requireDb(), 'buildings', buildingId, 'members'))
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Member, 'id'>) }))
}

export async function getMember(buildingId: string, userId: string): Promise<Member | null> {
  const snap = await getDoc(doc(requireDb(), 'buildings', buildingId, 'members', userId))
  if (!snap.exists()) return null
  return { id: snap.id, ...(snap.data() as Omit<Member, 'id'>) }
}

/** Δημιουργεί/ενημερώνει μέλος (merge). userId = αναγνωριστικό χρήστη. */
export async function saveMember(
  buildingId: string,
  userId: string,
  data: Omit<Member, 'id' | 'createdAt'>,
): Promise<void> {
  await setDoc(
    doc(requireDb(), 'buildings', buildingId, 'members', userId),
    { ...clean(data), createdAt: serverTimestamp() },
    { merge: true },
  )
}

export async function deleteMember(buildingId: string, userId: string): Promise<void> {
  await deleteDoc(doc(requireDb(), 'buildings', buildingId, 'members', userId))
}
