import { arrayUnion, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore'
import { col, clean, requireDb } from '../db'
import { compareEl } from '../format'
import type { Role, UserDoc } from '@/types'

export async function listUsers(): Promise<UserDoc[]> {
  const snap = await getDocs(col('users'))
  const rows = snap.docs.map((d) => ({ email: d.id, ...(d.data() as Omit<UserDoc, 'email'>) }))
  return rows.sort((a, b) => compareEl(a.name || a.email, b.name || b.email))
}

/**
 * Χρήστες που ανήκουν σε ένα από τα δοσμένα κτίρια (για διαχειριστές — βλέπουν
 * μόνο τους χρήστες των δικών τους κτιρίων). Ο superadmin χρησιμοποιεί listUsers.
 * Το query φιλτράρει με array-contains-any ώστε οι κανόνες να το επιτρέπουν.
 */
export async function listUsersByBuildings(buildingIds: string[]): Promise<UserDoc[]> {
  if (buildingIds.length === 0) return []
  // array-contains-any: έως 30 τιμές — αρκετά για τα κτίρια ενός διαχειριστή.
  const snap = await getDocs(
    query(col('users'), where('buildingIds', 'array-contains-any', buildingIds.slice(0, 30))),
  )
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

/**
 * Συνδέει χρήστη με κτίριο (χωρίς να χαλάει άλλα κτίρια — arrayUnion). Αν δεν
 * υπάρχει /users doc, δημιουργείται (θα σταλεί αυτόματα πρόσκληση). Θέτει ρόλο
 * μόνο αν δεν υπάρχει ήδη ισχυρότερος.
 */
export async function addUserToBuilding(
  identifier: string,
  buildingId: string,
  opts: { name?: string; role?: Role } = {},
): Promise<void> {
  const ref = doc(requireDb(), 'users', identifier)
  const snap = await getDoc(ref)
  if (snap.exists()) {
    await setDoc(
      ref,
      clean({ buildingIds: arrayUnion(buildingId) as unknown as string[], role: opts.role }),
      { merge: true },
    )
  } else {
    await setDoc(ref, {
      name: opts.name ?? '',
      role: opts.role ?? 'manager',
      buildingIds: [buildingId],
      apartmentIds: [],
      active: true,
      createdAt: serverTimestamp(),
    })
  }
}
