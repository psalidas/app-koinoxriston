import { httpsCallable } from 'firebase/functions'
import { functions } from './firebase'

/** Καλεί το `resendInvite` callable (επαναποστολή πρόσκλησης σε χρήστη). */
export async function resendInvite(userId: string): Promise<{ ok: boolean; channel: 'email' | 'sms' }> {
  if (!functions) throw new Error('Το Firebase δεν έχει ρυθμιστεί.')
  const fn = httpsCallable<{ userId: string }, { ok: boolean; channel: 'email' | 'sms' }>(
    functions,
    'resendInvite',
  )
  const res = await fn({ userId })
  return res.data
}
