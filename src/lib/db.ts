import {
  collection,
  type CollectionReference,
} from 'firebase/firestore'
import { db } from './firebase'

/** Throw a clear error when Firebase isn't configured yet. */
export function requireDb() {
  if (!db) {
    throw new Error(
      'Το Firebase δεν έχει ρυθμιστεί. Συμπληρώστε το .env (δείτε docs/SETUP.md).',
    )
  }
  return db
}

export function col(name: string): CollectionReference {
  return collection(requireDb(), name)
}

/** Remove keys with undefined values (Firestore rejects them). */
export function clean<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v
  }
  return out as Partial<T>
}
