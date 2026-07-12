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
import type { Ticket } from '@/types'

export async function listTickets(buildingId: string): Promise<Ticket[]> {
  const snap = await getDocs(query(col('tickets'), where('buildingId', '==', buildingId)))
  const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Ticket, 'id'>) }))
  return rows.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0))
}

export async function createTicket(data: Omit<Ticket, 'id'>): Promise<string> {
  const ref = await addDoc(col('tickets'), {
    ...clean(data),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return ref.id
}

export async function updateTicket(id: string, patch: Partial<Ticket>): Promise<void> {
  await updateDoc(doc(requireDb(), 'tickets', id), { ...clean(patch), updatedAt: serverTimestamp() })
}

export async function deleteTicket(id: string): Promise<void> {
  await deleteDoc(doc(requireDb(), 'tickets', id))
}
