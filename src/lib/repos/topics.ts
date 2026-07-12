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
import type { Comment, Offer, Topic } from '@/types'

// ── Topics ──
export async function listTopics(buildingId: string): Promise<Topic[]> {
  const snap = await getDocs(query(col('topics'), where('buildingId', '==', buildingId)))
  const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Topic, 'id'>) }))
  return rows.sort((a, b) => {
    if (!!b.pinned !== !!a.pinned) return b.pinned ? 1 : -1
    return (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0)
  })
}

export async function getTopic(id: string): Promise<Topic | null> {
  const snap = await getDoc(doc(requireDb(), 'topics', id))
  if (!snap.exists()) return null
  return { id: snap.id, ...(snap.data() as Omit<Topic, 'id'>) }
}

export async function createTopic(data: Omit<Topic, 'id'>): Promise<string> {
  const ref = await addDoc(col('topics'), { ...clean(data), createdAt: serverTimestamp() })
  return ref.id
}

export async function updateTopic(id: string, patch: Partial<Topic>): Promise<void> {
  await updateDoc(doc(requireDb(), 'topics', id), clean(patch))
}

export async function deleteTopic(id: string): Promise<void> {
  await deleteDoc(doc(requireDb(), 'topics', id))
}

// ── Comments ──
export async function listComments(topicId: string): Promise<Comment[]> {
  const snap = await getDocs(query(col('comments'), where('topicId', '==', topicId)))
  const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Comment, 'id'>) }))
  return rows.sort((a, b) => (a.createdAt?.toMillis?.() ?? 0) - (b.createdAt?.toMillis?.() ?? 0))
}

export async function createComment(data: Omit<Comment, 'id'>): Promise<string> {
  const ref = await addDoc(col('comments'), { ...clean(data), createdAt: serverTimestamp() })
  return ref.id
}

export async function deleteComment(id: string): Promise<void> {
  await deleteDoc(doc(requireDb(), 'comments', id))
}

// ── Offers ──
export async function listOffers(topicId: string): Promise<Offer[]> {
  const snap = await getDocs(query(col('offers'), where('topicId', '==', topicId)))
  const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Offer, 'id'>) }))
  return rows.sort((a, b) => (a.amount ?? Infinity) - (b.amount ?? Infinity))
}

export async function createOffer(data: Omit<Offer, 'id'>): Promise<string> {
  const ref = await addDoc(col('offers'), { ...clean(data), createdAt: serverTimestamp() })
  return ref.id
}

export async function deleteOffer(id: string): Promise<void> {
  await deleteDoc(doc(requireDb(), 'offers', id))
}
