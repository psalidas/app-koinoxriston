import { addDoc, deleteDoc, doc, getDocs, query, serverTimestamp, where } from 'firebase/firestore'
import { col, clean, requireDb } from '../db'
import type { AnnouncementComment } from '@/types'

/** Όλα τα σχόλια ανακοινώσεων ενός κτιρίου (ομαδοποιούνται client-side ανά ανακοίνωση). */
export async function listAnnouncementComments(buildingId: string): Promise<AnnouncementComment[]> {
  const snap = await getDocs(query(col('announcementComments'), where('buildingId', '==', buildingId)))
  const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AnnouncementComment, 'id'>) }))
  return rows.sort((a, b) => (a.createdAt?.toMillis?.() ?? 0) - (b.createdAt?.toMillis?.() ?? 0))
}

export async function createAnnouncementComment(data: Omit<AnnouncementComment, 'id'>): Promise<string> {
  const ref = await addDoc(col('announcementComments'), { ...clean(data), createdAt: serverTimestamp() })
  return ref.id
}

export async function deleteAnnouncementComment(id: string): Promise<void> {
  await deleteDoc(doc(requireDb(), 'announcementComments', id))
}
