import { httpsCallable } from 'firebase/functions'
import { functions } from './firebase'

export interface BulkResultRow {
  id: string
  ok: boolean
  reason?: string
}

export interface BulkResult {
  ok: boolean
  channel: 'email' | 'sms'
  sent: number
  failed: number
  results: BulkResultRow[]
}

/** Μαζική αποστολή email ή SMS σε επιλεγμένους χρήστες (doc ids). */
export async function sendBulkMessage(input: {
  channel: 'email' | 'sms'
  subject?: string
  body: string
  recipientIds: string[]
}): Promise<BulkResult> {
  if (!functions) throw new Error('Το Firebase δεν έχει ρυθμιστεί.')
  const fn = httpsCallable<typeof input, BulkResult>(functions, 'sendBulkMessage')
  const res = await fn(input)
  return res.data
}
