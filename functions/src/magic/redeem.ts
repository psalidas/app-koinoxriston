// `redeemMagicLink` callable — εξαργυρώνει το one-time token και επιστρέφει
// custom token για `signInWithCustomToken` στον client. Δουλεύει για email
// και κινητό (get-or-create Firebase Auth user βάσει αναγνωριστικού).

import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { logger } from 'firebase-functions/v2'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import { identifierType } from './links'

export const redeemMagicLink = onCall(
  { invoker: 'public' },
  async (request): Promise<{ token: string }> => {
    try {
      const token = typeof request.data?.token === 'string' ? request.data.token.trim() : ''
      if (!token) throw new HttpsError('invalid-argument', 'Λείπει το token.')

      const db = getFirestore()
      const ref = db.doc(`magicTokens/${token}`)

      // 1) Επικύρωση (read-only) — ΔΕΝ μαρκάρουμε ακόμη «used», ώστε μια
      //    παροδική αποτυχία παρακάτω να μην «καίει» τον σύνδεσμο.
      const snap = await ref.get()
      if (!snap.exists) throw new HttpsError('not-found', 'Ο σύνδεσμος δεν είναι έγκυρος.')
      const d = snap.data() as { identifier?: string; used?: boolean; expiresAt?: Timestamp }
      if (d.used) throw new HttpsError('failed-precondition', 'Ο σύνδεσμος έχει ήδη χρησιμοποιηθεί.')
      if (Date.now() > (d.expiresAt?.toMillis?.() ?? 0)) {
        throw new HttpsError('deadline-exceeded', 'Ο σύνδεσμος έληξε.')
      }
      const identifier = d.identifier ?? ''

      const type = identifierType(identifier)
      const auth = getAuth()
      let uid: string
      if (type === 'email') {
        try {
          uid = (await auth.getUserByEmail(identifier)).uid
        } catch {
          uid = (await auth.createUser({ email: identifier })).uid
        }
      } else if (type === 'phone') {
        try {
          uid = (await auth.getUserByPhoneNumber(identifier)).uid
        } catch {
          uid = (await auth.createUser({ phoneNumber: identifier })).uid
        }
      } else {
        throw new HttpsError('failed-precondition', 'Μη έγκυρο αναγνωριστικό.')
      }

      const customToken = await auth.createCustomToken(uid)

      // 2) Μόνο τώρα (μετά την επιτυχία) μαρκάρουμε single-use, ατομικά.
      await db.runTransaction(async (tx) => {
        const s = await tx.get(ref)
        if (!s.exists || s.data()?.used) {
          throw new HttpsError('failed-precondition', 'Ο σύνδεσμος έχει ήδη χρησιμοποιηθεί.')
        }
        tx.update(ref, { used: true, usedAt: Timestamp.now() })
      })

      return { token: customToken }
    } catch (e) {
      if (e instanceof HttpsError) throw e
      const msg = e instanceof Error ? e.message : String(e)
      logger.error('[magic] redeem failed', { error: e instanceof Error ? e.stack ?? msg : msg })
      throw new HttpsError('failed-precondition', msg || 'Αποτυχία εισόδου.')
    }
  },
)
