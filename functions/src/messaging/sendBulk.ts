// `sendBulkMessage` callable — μαζική αποστολή email ή SMS σε επιλεγμένους
// χρήστες (Διαχείριση → Μαζική αποστολή). Auth: μόνο διαχειριστές.
//
// Κανάλι το επιλέγει ο διαχειριστής:
//   • email → Brevo   (env: BREVO_API_KEY, αποστολέας από settings/invites)
//   • sms   → SMS.to  (env: SMSTO_API_KEY, sender από settings/invites)
//
// Παραλήπτες = ρητή λίστα doc ids (users/{id}). Για κάθε χρήστη βρίσκουμε τον
// προορισμό στο επιλεγμένο κανάλι:
//   • email → το id αν είναι email
//   • sms   → το id αν είναι κινητό, αλλιώς το πεδίο `phone` του χρήστη
// Χρήστες χωρίς προορισμό στο κανάλι παραλείπονται (skipped) με λόγο.

import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { logger } from 'firebase-functions/v2'
import { getFirestore } from 'firebase-admin/firestore'
import { loadInviteConfig } from '../invites/send'
import { requireManager } from '../invites/auth'
import { sendBrevoEmail } from '../invites/brevoClient'
import { sendSmsTo } from '../invites/smsToClient'

const isEmail = (id: string) => id.includes('@')
const isPhone = (id: string) => /^\+?\d[\d\s]{6,}$/.test(id)
const normPhone = (id: string) => (id.startsWith('+') ? id : `+${id.replace(/\s+/g, '')}`)

function escapeHtml(s: string): string {
  return s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c] as string)
}

/** Μετατρέπει απλό κείμενο (με αλλαγές γραμμής) σε ασφαλές HTML email. */
function textToHtml(body: string): string {
  return `<div style="font-family:system-ui,Arial,sans-serif;font-size:14px;color:#111;line-height:1.5">${escapeHtml(
    body,
  ).replace(/\n/g, '<br>')}</div>`
}

export interface BulkResultRow {
  id: string
  ok: boolean
  /** λόγος αποτυχίας ή παράλειψης (όταν ok=false) */
  reason?: string
}

export const sendBulkMessage = onCall(
  { invoker: 'public' },
  async (
    request,
  ): Promise<{ ok: true; channel: 'email' | 'sms'; sent: number; failed: number; results: BulkResultRow[] }> => {
    const db = getFirestore()
    await requireManager(db, request.auth as { token?: { email?: string } } | undefined)

    const channel = request.data?.channel
    const subject = typeof request.data?.subject === 'string' ? request.data.subject.trim() : ''
    const body = typeof request.data?.body === 'string' ? request.data.body.trim() : ''
    const recipientIds: string[] = Array.isArray(request.data?.recipientIds)
      ? request.data.recipientIds.filter((x: unknown): x is string => typeof x === 'string' && !!x.trim()).map((x: string) => x.trim())
      : []

    if (channel !== 'email' && channel !== 'sms') {
      throw new HttpsError('invalid-argument', 'Άγνωστο κανάλι (email/sms).')
    }
    if (!body) throw new HttpsError('invalid-argument', 'Λείπει το μήνυμα.')
    if (channel === 'email' && !subject) {
      throw new HttpsError('invalid-argument', 'Λείπει το θέμα του email.')
    }
    if (recipientIds.length === 0) {
      throw new HttpsError('invalid-argument', 'Δεν επιλέχθηκαν παραλήπτες.')
    }
    if (recipientIds.length > 500) {
      throw new HttpsError('invalid-argument', 'Πάρα πολλοί παραλήπτες (μέγιστο 500).')
    }

    const cfg = await loadInviteConfig(db)
    if (channel === 'email') {
      if (!process.env.BREVO_API_KEY) {
        throw new HttpsError('failed-precondition', 'Λείπει το BREVO_API_KEY (GitHub secret / functions env).')
      }
      if (!cfg.fromEmail) {
        throw new HttpsError('failed-precondition', 'Δεν έχει οριστεί «Email αποστολέα» στις Ρυθμίσεις προσκλήσεων.')
      }
    } else if (!process.env.SMSTO_API_KEY) {
      throw new HttpsError('failed-precondition', 'Λείπει το SMSTO_API_KEY (GitHub secret / functions env).')
    }

    const html = channel === 'email' ? textToHtml(body) : ''
    const results: BulkResultRow[] = []

    // Ακολουθιακά — για μικρές πολυκατοικίες είναι απλό & ασφαλές έναντι
    // rate limits των παρόχων. Ένα σφάλμα δεν σταματά τα υπόλοιπα.
    for (const id of recipientIds) {
      try {
        const snap = await db.doc(`users/${id}`).get()
        if (!snap.exists) {
          results.push({ id, ok: false, reason: 'Δεν βρέθηκε ο χρήστης.' })
          continue
        }
        const data = snap.data() as { name?: string; phone?: string; active?: boolean }
        const name = typeof data.name === 'string' ? data.name : ''

        if (channel === 'email') {
          if (!isEmail(id)) {
            results.push({ id, ok: false, reason: 'Χωρίς email.' })
            continue
          }
          await sendBrevoEmail(process.env.BREVO_API_KEY!, {
            toEmail: id,
            toName: name || undefined,
            subject,
            html,
            fromEmail: cfg.fromEmail,
            fromName: cfg.fromName,
          })
        } else {
          const phoneRaw = isPhone(id) ? id : typeof data.phone === 'string' && isPhone(data.phone) ? data.phone : ''
          if (!phoneRaw) {
            results.push({ id, ok: false, reason: 'Χωρίς κινητό.' })
            continue
          }
          await sendSmsTo(process.env.SMSTO_API_KEY!, {
            to: normPhone(phoneRaw),
            message: body,
            sender: cfg.smsSender,
          })
        }
        results.push({ id, ok: true })
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        logger.warn('[bulk] send failed', { id, channel, reason: msg.slice(0, 200) })
        results.push({ id, ok: false, reason: msg.slice(0, 200) })
      }
    }

    const sent = results.filter((r) => r.ok).length
    const failed = results.length - sent
    logger.info('[bulk] done', { channel, total: results.length, sent, failed })
    return { ok: true, channel, sent, failed, results }
  },
)
