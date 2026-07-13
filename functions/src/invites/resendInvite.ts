// `resendInvite` callable — χειροκίνητη (επαν)αποστολή πρόσκλησης από τη
// λίστα χρηστών (Διαχείριση → Χρήστες). Χρήσιμο για χρήστες που φτιάχτηκαν
// πριν ρυθμιστούν τα κλειδιά, ή για επαναποστολή. Auth: μόνο διαχειριστές.

import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { getFirestore } from 'firebase-admin/firestore'
import { loadInviteConfig, sendInvite } from './send'

const BOOTSTRAP_ADMIN_EMAIL = 'michael@crowdpolicy.com'

async function requireManager(
  db: FirebaseFirestore.Firestore,
  auth: { token?: { email?: string } } | undefined,
): Promise<void> {
  const email = auth?.token?.email?.toLowerCase()
  if (!email) throw new HttpsError('unauthenticated', 'Δεν είστε συνδεδεμένος.')
  if (email === BOOTSTRAP_ADMIN_EMAIL) return
  const snap = await db.doc(`users/${email}`).get()
  const role = snap.exists ? (snap.data()?.role as string | undefined) : undefined
  if (role !== 'admin' && role !== 'manager') {
    throw new HttpsError('permission-denied', 'Απαιτείται ρόλος διαχειριστή.')
  }
}

export const resendInvite = onCall(
  { invoker: 'public' },
  async (request): Promise<{ ok: true; channel: 'email' | 'sms' }> => {
    const db = getFirestore()
    await requireManager(db, request.auth as { token?: { email?: string } } | undefined)

    const userId = typeof request.data?.userId === 'string' ? request.data.userId.trim() : ''
    if (!userId) throw new HttpsError('invalid-argument', 'Λείπει το αναγνωριστικό χρήστη.')

    const snap = await db.doc(`users/${userId}`).get()
    if (!snap.exists) throw new HttpsError('not-found', 'Ο χρήστης δεν βρέθηκε.')

    const cfg = await loadInviteConfig(db)
    if (!cfg.enabled) {
      throw new HttpsError('failed-precondition', 'Οι προσκλήσεις είναι απενεργοποιημένες στις ρυθμίσεις.')
    }

    try {
      const channel = await sendInvite(db, userId, snap.data()!, cfg)
      return { ok: true, channel }
    } catch (e) {
      throw new HttpsError('internal', e instanceof Error ? e.message : 'Αποτυχία αποστολής πρόσκλησης.')
    }
  },
)
