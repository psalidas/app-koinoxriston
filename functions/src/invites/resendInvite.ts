// `resendInvite` callable — χειροκίνητη (επαν)αποστολή πρόσκλησης από τη
// λίστα χρηστών (Διαχείριση → Χρήστες). Χρήσιμο για χρήστες που φτιάχτηκαν
// πριν ρυθμιστούν τα κλειδιά, ή για επαναποστολή. Auth: μόνο διαχειριστές.

import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { getFirestore } from 'firebase-admin/firestore'
import { loadInviteConfig, sendInvite } from './send'
import { requireManager } from './auth'

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
