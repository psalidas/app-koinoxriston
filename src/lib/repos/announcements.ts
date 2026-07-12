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
import type { Announcement } from '@/types'

export async function listAnnouncements(buildingId: string): Promise<Announcement[]> {
  const snap = await getDocs(query(col('announcements'), where('buildingId', '==', buildingId)))
  const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Announcement, 'id'>) }))
  return rows.sort((a, b) => {
    if (!!b.pinned !== !!a.pinned) return b.pinned ? 1 : -1
    return (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0)
  })
}

export async function createAnnouncement(data: Omit<Announcement, 'id'>): Promise<string> {
  const ref = await addDoc(col('announcements'), { ...clean(data), createdAt: serverTimestamp() })
  return ref.id
}

export async function updateAnnouncement(id: string, patch: Partial<Announcement>): Promise<void> {
  await updateDoc(doc(requireDb(), 'announcements', id), clean(patch))
}

export async function deleteAnnouncement(id: string): Promise<void> {
  await deleteDoc(doc(requireDb(), 'announcements', id))
}
