import { addDoc, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore'
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
