import { deleteDoc, doc, getDocs, setDoc, updateDoc } from 'firebase/firestore'
import { col, clean, requireDb } from '../db'
import { compareEl } from '../format'
import type { UserDoc } from '@/types'

export async function listUsers(): Promise<UserDoc[]> {
  const snap = await getDocs(col('users'))
  const rows = snap.docs.map((d) => ({ email: d.id, ...(d.data() as Omit<UserDoc, 'email'>) }))
  return rows.sort((a, b) => compareEl(a.name || a.email, b.name || b.email))
}

export async function saveUser(email: string, data: Omit<UserDoc, 'email'>): Promise<void> {
  await setDoc(doc(requireDb(), 'users', email), clean(data), { merge: true })
}

export async function updateUser(email: string, patch: Partial<UserDoc>): Promise<void> {
  await updateDoc(doc(requireDb(), 'users', email), clean(patch))
}

export async function deleteUser(email: string): Promise<void> {
  await deleteDoc(doc(requireDb(), 'users', email))
}
