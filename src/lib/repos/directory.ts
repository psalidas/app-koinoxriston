import { doc, getDoc, getDocs, setDoc, serverTimestamp } from 'firebase/firestore'
import { col, clean, requireDb } from '../db'
import type { ContactProfile, DirectoryEntry, Role } from '@/types'

/** Το ιδιωτικό προφίλ του χρήστη (self ή manager). */
export async function getProfile(id: string): Promise<ContactProfile | null> {
  const snap = await getDoc(doc(requireDb(), 'profiles', id))
  if (!snap.exists()) return null
  return { identifier: id, ...(snap.data() as Omit<ContactProfile, 'identifier'>) }
}

/**
 * Αποθηκεύει το ιδιωτικό προφίλ ΚΑΙ ξαναγράφει την εγγραφή καταλόγου με μόνο
 * τα ορατά πεδία (overwrite ώστε να αφαιρούνται όσα κρύφτηκαν).
 */
export async function saveContact(
  id: string,
  profile: Omit<ContactProfile, 'identifier' | 'updatedAt'>,
  meta: { role: Role; name: string; apartmentCodes: string[] },
): Promise<void> {
  const db = requireDb()
  await setDoc(
    doc(db, 'profiles', id),
    { ...clean(profile as unknown as Record<string, unknown>), updatedAt: serverTimestamp() },
    { merge: true },
  )

  const vis = profile.visibility ?? {}
  const entry: Record<string, unknown> = {
    identifier: id,
    role: meta.role,
    apartmentCodes: meta.apartmentCodes,
    updatedAt: serverTimestamp(),
  }
  const displayName = (profile.displayName || meta.name || '').trim()
  if (vis.name && displayName) entry.name = displayName
  if (vis.phone && profile.phone?.trim()) entry.phone = profile.phone.trim()
  if (vis.mobile && profile.mobile?.trim()) entry.mobile = profile.mobile.trim()
  if (vis.email && profile.email?.trim()) entry.email = profile.email.trim()
  if (vis.note && profile.note?.trim()) entry.note = profile.note.trim()

  // merge:false → η εγγραφή αντικαθίσταται πλήρως (κρυμμένα πεδία φεύγουν).
  await setDoc(doc(db, 'directory', id), entry)
}

/** Ο κατάλογος όπως τον βλέπουν όλοι (φιλτραρισμένος). */
export async function listDirectory(): Promise<DirectoryEntry[]> {
  const snap = await getDocs(col('directory'))
  return snap.docs.map((d) => ({ identifier: d.id, ...(d.data() as Omit<DirectoryEntry, 'identifier'>) }))
}

/** Όλα τα προφίλ (μόνο διαχειριστές — πλήρη στοιχεία). */
export async function listProfiles(): Promise<ContactProfile[]> {
  const snap = await getDocs(col('profiles'))
  return snap.docs.map((d) => ({ identifier: d.id, ...(d.data() as Omit<ContactProfile, 'identifier'>) }))
}
