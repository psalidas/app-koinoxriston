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
import { deleteFile } from '../upload'
import type { DocEntry } from '@/types'

export async function listDocEntries(buildingId: string): Promise<DocEntry[]> {
  const snap = await getDocs(query(col('documents'), where('buildingId', '==', buildingId)))
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<DocEntry, 'id'>) }))
}

export async function createFolder(data: {
  buildingId: string
  name: string
  parentId: string | null
  createdBy?: string
}): Promise<string> {
  const ref = await addDoc(col('documents'), {
    ...clean({ ...data, kind: 'folder' as const }),
    createdAt: serverTimestamp(),
  })
  return ref.id
}

export async function createFileEntry(data: {
  buildingId: string
  name: string
  parentId: string | null
  url: string
  path: string
  size?: number
  contentType?: string
  createdBy?: string
}): Promise<string> {
  const ref = await addDoc(col('documents'), {
    ...clean({ ...data, kind: 'file' as const }),
    createdAt: serverTimestamp(),
  })
  return ref.id
}

export async function renameDocEntry(id: string, name: string): Promise<void> {
  await updateDoc(doc(requireDb(), 'documents', id), { name })
}

/**
 * Delete an entry. For files, also removes the stored blob. For folders, the
 * whole subtree (child folders + files) is removed recursively.
 */
export async function deleteDocEntry(entry: DocEntry, all: DocEntry[]): Promise<void> {
  if (entry.kind === 'file') {
    if (entry.path) await deleteFile(entry.path)
    await deleteDoc(doc(requireDb(), 'documents', entry.id))
    return
  }
  // Folder: remove descendants first, then the folder itself.
  const children = all.filter((e) => e.parentId === entry.id)
  for (const child of children) await deleteDocEntry(child, all)
  await deleteDoc(doc(requireDb(), 'documents', entry.id))
}
