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
import type { Statement } from '@/types'

export async function listStatements(buildingId: string): Promise<Statement[]> {
  const snap = await getDocs(query(col('statements'), where('buildingId', '==', buildingId)))
  const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Statement, 'id'>) }))
  return rows.sort((a, b) => (a.period < b.period ? 1 : a.period > b.period ? -1 : 0))
}

export async function getStatement(id: string): Promise<Statement | null> {
  const snap = await getDoc(doc(requireDb(), 'statements', id))
  if (!snap.exists()) return null
  return { id: snap.id, ...(snap.data() as Omit<Statement, 'id'>) }
}

export async function createStatement(data: Omit<Statement, 'id'>): Promise<string> {
  const ref = await addDoc(col('statements'), {
    ...clean(data),
    createdAt: serverTimestamp(),
  })
  return ref.id
}

export async function updateStatement(id: string, patch: Partial<Statement>): Promise<void> {
  await updateDoc(doc(requireDb(), 'statements', id), clean(patch))
}

export async function markIssued(id: string, issuedBy: string): Promise<void> {
  await updateDoc(doc(requireDb(), 'statements', id), {
    status: 'issued',
    issuedBy,
    issuedAt: serverTimestamp(),
  })
}

export async function deleteStatement(id: string): Promise<void> {
  await deleteDoc(doc(requireDb(), 'statements', id))
}
