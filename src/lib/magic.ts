import { httpsCallable } from 'firebase/functions'
import { functions } from './firebase'

/** Ζητά αποστολή magic link (email ή κινητό). Πάντα «ok» — δεν αποκαλύπτει
 *  αν υπάρχει ο λογαριασμός. */
export async function requestMagicLink(identifier: string): Promise<{ ok: boolean }> {
  if (!functions) throw new Error('Το Firebase δεν έχει ρυθμιστεί.')
  const fn = httpsCallable<{ identifier: string }, { ok: boolean }>(functions, 'requestMagicLink')
  return (await fn({ identifier })).data
}

/** Εξαργυρώνει το token και επιστρέφει custom token για signInWithCustomToken. */
export async function redeemMagicLink(token: string): Promise<{ token: string }> {
  if (!functions) throw new Error('Το Firebase δεν έχει ρυθμιστεί.')
  const fn = httpsCallable<{ token: string }, { token: string }>(functions, 'redeemMagicLink')
  return (await fn({ token })).data
}
