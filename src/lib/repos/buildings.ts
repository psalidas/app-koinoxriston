import { addDoc, arrayRemove, collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where, writeBatch } from 'firebase/firestore'
import { col, clean, requireDb } from '../db'
import type { Building } from '@/types'

export async function listBuildings(): Promise<Building[]> {
  const snap = await getDocs(col('buildings'))
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Building, 'id'>) }))
}

/** Παράγει slug από όνομα/διεύθυνση (λατινικά, πεζά, παύλες). */
export function slugify(input: string): string {
  const map: Record<string, string> = {
    α: 'a', ά: 'a', β: 'v', γ: 'g', δ: 'd', ε: 'e', έ: 'e', ζ: 'z', η: 'i', ή: 'i',
    θ: 'th', ι: 'i', ί: 'i', ϊ: 'i', ΐ: 'i', κ: 'k', λ: 'l', μ: 'm', ν: 'n', ξ: 'x',
    ο: 'o', ό: 'o', π: 'p', ρ: 'r', σ: 's', ς: 's', τ: 't', υ: 'y', ύ: 'y', ϋ: 'y',
    φ: 'f', χ: 'ch', ψ: 'ps', ω: 'o', ώ: 'o',
  }
  return (input || '')
    .toLowerCase()
    .split('')
    .map((c) => map[c] ?? c)
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

/** Επιστρέφει μοναδικό slug (προσθέτει -2, -3 … αν υπάρχει ήδη). */
export async function uniqueSlug(base: string): Promise<string> {
  const wanted = slugify(base) || 'ktirio'
  const all = await listBuildings()
  const taken = new Set(all.map((b) => b.slug).filter(Boolean) as string[])
  if (!taken.has(wanted)) return wanted
  let i = 2
  while (taken.has(`${wanted}-${i}`)) i++
  return `${wanted}-${i}`
}

export async function getBuildingBySlug(slug: string): Promise<Building | null> {
  const snap = await getDocs(query(col('buildings'), where('slug', '==', slug)))
  const d = snap.docs[0]
  return d ? { id: d.id, ...(d.data() as Omit<Building, 'id'>) } : null
}

/** Δημιουργεί νέο κτίριο (auto id) και επιστρέφει το id. */
export async function createBuilding(data: Omit<Building, 'id'>): Promise<string> {
  const ref = await addDoc(col('buildings'), { ...clean(data), createdAt: serverTimestamp() })
  return ref.id
}

export async function getBuilding(id: string): Promise<Building | null> {
  const snap = await getDoc(doc(requireDb(), 'buildings', id))
  if (!snap.exists()) return null
  return { id: snap.id, ...(snap.data() as Omit<Building, 'id'>) }
}

export async function saveBuilding(id: string, data: Omit<Building, 'id'>): Promise<void> {
  await setDoc(doc(requireDb(), 'buildings', id), clean(data), { merge: true })
}

export async function updateBuilding(
  id: string,
  patch: Partial<Building>,
): Promise<void> {
  await updateDoc(doc(requireDb(), 'buildings', id), clean(patch))
}

export interface DeleteBuildingResult {
  deletedDocs: number
}

// Συλλογές (flat) με πεδίο buildingId που ανήκουν στο κτίριο.
const BUILDING_COLLECTIONS = [
  'apartments', 'people', 'expenses', 'payments', 'statements', 'fundEntries',
  'documents', 'announcements', 'contracts', 'works', 'contacts', 'assemblies',
  'polls', 'tickets', 'topics', 'auditLogs',
]

// Διαγράφει σε δέσμες των 400 (όριο batch 500).
async function deleteRefs(refs: { path: string }[]): Promise<number> {
  const db = requireDb()
  let n = 0
  for (let i = 0; i < refs.length; i += 400) {
    const batch = writeBatch(db)
    for (const r of refs.slice(i, i + 400)) batch.delete(doc(db, r.path))
    await batch.commit()
    n += Math.min(400, refs.length - i)
  }
  return n
}

async function refsByBuilding(colName: string, buildingId: string) {
  const snap = await getDocs(query(col(colName), where('buildingId', '==', buildingId)))
  return snap.docs.map((d) => ({ path: d.ref.path, id: d.id }))
}

/**
 * ΟΡΙΣΤΙΚΗ διαγραφή κτιρίου και ΟΛΩΝ των δεδομένων του (superadmin only).
 * Μη αναστρέψιμο. Δεν καθαρίζει αρχεία Storage (παραμένουν ανενεργά).
 */
export async function deleteBuildingCascade(buildingId: string): Promise<DeleteBuildingResult> {
  const db = requireDb()
  let deletedDocs = 0

  // 1) Θυγατρικά σχόλια/προσφορές (ανά topic) & ψήφοι (ανά poll).
  const topics = await refsByBuilding('topics', buildingId)
  const polls = await refsByBuilding('polls', buildingId)
  for (const t of topics) {
    for (const child of ['comments', 'offers']) {
      const snap = await getDocs(query(col(child), where('topicId', '==', t.id)))
      deletedDocs += await deleteRefs(snap.docs.map((d) => ({ path: d.ref.path })))
    }
  }
  for (const p of polls) {
    const snap = await getDocs(query(col('votes'), where('pollId', '==', p.id)))
    deletedDocs += await deleteRefs(snap.docs.map((d) => ({ path: d.ref.path })))
  }

  // 2) Όλες οι flat συλλογές με buildingId.
  for (const c of BUILDING_COLLECTIONS) {
    const refs = await refsByBuilding(c, buildingId)
    deletedDocs += await deleteRefs(refs)
  }

  // 3) Μετρητής κτιρίου (doc id == buildingId).
  await deleteDoc(doc(db, 'counters', buildingId)).catch(() => {})

  // 4) Μέλη (υποσυλλογή).
  const members = await getDocs(collection(db, 'buildings', buildingId, 'members'))
  deletedDocs += await deleteRefs(members.docs.map((d) => ({ path: d.ref.path })))

  // 5) Αφαίρεσε το κτίριο από τα buildingIds των χρηστών.
  const users = await getDocs(query(col('users'), where('buildingIds', 'array-contains', buildingId)))
  for (let i = 0; i < users.docs.length; i += 400) {
    const batch = writeBatch(db)
    for (const u of users.docs.slice(i, i + 400)) {
      batch.update(u.ref, { buildingIds: arrayRemove(buildingId) })
    }
    await batch.commit()
  }

  // 6) Το ίδιο το κτίριο.
  await deleteDoc(doc(db, 'buildings', buildingId))
  deletedDocs += 1

  return { deletedDocs }
}
