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
  body?: string
  /** Προαιρετικά εξατομικευμένα κείμενα ανά παραλήπτη (id → κείμενο). */
  bodies?: Record<string, string>
  recipientIds: string[]
}): Promise<BulkResult> {
  if (!functions) throw new Error('Το Firebase δεν έχει ρυθμιστεί.')
  const fn = httpsCallable<typeof input, BulkResult>(functions, 'sendBulkMessage')
  const res = await fn(input)
  return res.data
}

/** Αποστολή ενός email με συνημμένα PDF σε έναν παραλήπτη. */
export async function sendEmailWithAttachments(input: {
  to: string
  toName?: string
  subject: string
  body: string
  attachments: { name: string; content: string }[]
}): Promise<{ ok: true }> {
  if (!functions) throw new Error('Το Firebase δεν έχει ρυθμιστεί.')
  const fn = httpsCallable<typeof input, { ok: true }>(functions, 'sendEmailWithAttachments')
  const res = await fn(input)
  return res.data
}
