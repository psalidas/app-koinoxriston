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

/** Δοκιμαστική αποστολή σε συγκεκριμένο παραλήπτη (email ή κινητό). */
export async function sendTestInvite(
  channel: 'email' | 'sms',
  to: string,
): Promise<{ ok: boolean; channel: 'email' | 'sms' }> {
  if (!functions) throw new Error('Το Firebase δεν έχει ρυθμιστεί.')
  const fn = httpsCallable<{ channel: 'email' | 'sms'; to: string }, { ok: boolean; channel: 'email' | 'sms' }>(
    functions,
    'sendTestInvite',
  )
  const res = await fn({ channel, to })
  return res.data
}
