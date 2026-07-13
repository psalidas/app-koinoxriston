// Κοινή λογική magic-link: παραγωγή one-time token + σύνδεσμος εισόδου.
//
// Το token αποθηκεύεται στο `magicTokens/{token}` (deny-all στα rules — μόνο
// Admin SDK). Ο σύνδεσμος είναι `${appUrl}/magic?t=<token>`. Η εξαργύρωση
// γίνεται από το callable `redeemMagicLink` (custom token → signInWithCustomToken).

import { randomBytes } from 'crypto'
import { Timestamp } from 'firebase-admin/firestore'

export type IdentifierType = 'email' | 'phone' | null

export function identifierType(id: string): IdentifierType {
  if (id.includes('@')) return 'email'
  if (/^\+?\d[\d\s]{6,}$/.test(id)) return 'phone'
  return null
}

/** Κανονικοποίηση: email→lowercase, κινητό→E.164 (default +30 Ελλάδα). */
export function normalizeIdentifier(raw: string): string {
  const s = (raw ?? '').trim()
  if (!s) return ''
  if (s.includes('@')) return s.toLowerCase()
  const p = s.replace(/\s+/g, '')
  if (p.startsWith('+')) return p
  if (/^\d+$/.test(p)) return `+30${p}`
  return p
}

/** Δημιουργεί one-time token, το αποθηκεύει και επιστρέφει τον σύνδεσμο. */
export async function createMagicLink(
  db: FirebaseFirestore.Firestore,
  identifier: string,
  appUrl: string,
  ttlMinutes: number,
): Promise<string> {
  const token = randomBytes(32).toString('hex')
  const now = Date.now()
  await db.collection('magicTokens').doc(token).set({
    identifier,
    createdAt: Timestamp.now(),
    expiresAt: Timestamp.fromMillis(now + ttlMinutes * 60_000),
    used: false,
  })
  const base = appUrl.replace(/\/+$/, '')
  return `${base}/magic?t=${token}`
}
