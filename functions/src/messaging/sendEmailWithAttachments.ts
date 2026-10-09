// `sendEmailWithAttachments` callable — αποστολή ΕΝΟΣ email με συνημμένα PDF
// (π.χ. ειδοποιητήριο/-α + συγκεντρωτική) σε έναν παραλήπτη. Auth: διαχειριστές.
//
// Ξεχωριστό από το `sendBulkMessage` επειδή τα συνημμένα είναι εξατομικευμένα
// ανά παραλήπτη — ο client καλεί μία φορά ανά παραλήπτη ώστε το μέγεθος κάθε
// αιτήματος να παραμένει φραγμένο.

import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { logger } from 'firebase-functions/v2'
import { getFirestore } from 'firebase-admin/firestore'
import { loadInviteConfig } from '../invites/send'
import { requireManager } from '../invites/auth'
import { sendBrevoEmail } from '../invites/brevoClient'

const isEmail = (id: string) => id.includes('@')

function escapeHtml(s: string): string {
  return s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c] as string)
}
function textToHtml(body: string): string {
  return `<div style="font-family:system-ui,Arial,sans-serif;font-size:14px;color:#111;line-height:1.5">${escapeHtml(
    body,
  ).replace(/\n/g, '<br>')}</div>`
}

interface Attachment { name: string; content: string }

export const sendEmailWithAttachments = onCall(
  { invoker: 'public', memory: '512MiB' },
  async (request): Promise<{ ok: true }> => {
    const db = getFirestore()
    await requireManager(db, request.auth as { token?: { email?: string } } | undefined)

    const to = typeof request.data?.to === 'string' ? request.data.to.trim() : ''
    const toName = typeof request.data?.toName === 'string' ? request.data.toName.trim() : ''
    const subject = typeof request.data?.subject === 'string' ? request.data.subject.trim() : ''
    const body = typeof request.data?.body === 'string' ? request.data.body.trim() : ''
    const rawAtt: unknown = request.data?.attachments
    const attachments: Attachment[] = Array.isArray(rawAtt)
      ? rawAtt
          .filter(
            (a: unknown): a is Attachment =>
              !!a && typeof (a as Attachment).name === 'string' && typeof (a as Attachment).content === 'string',
          )
          .map((a) => ({ name: a.name, content: a.content }))
      : []

    if (!isEmail(to)) throw new HttpsError('invalid-argument', 'Μη έγκυρο email παραλήπτη.')
    if (!subject) throw new HttpsError('invalid-argument', 'Λείπει το θέμα.')
    if (!body) throw new HttpsError('invalid-argument', 'Λείπει το μήνυμα.')

    // Φράγμα μεγέθους (~12MB base64) ώστε να μη χτυπά το όριο του Brevo.
    const totalBytes = attachments.reduce((s, a) => s + a.content.length, 0)
    if (totalBytes > 12_000_000) {
      throw new HttpsError('invalid-argument', 'Τα συνημμένα είναι πολύ μεγάλα.')
    }

    if (!process.env.BREVO_API_KEY) {
      throw new HttpsError('failed-precondition', 'Λείπει το BREVO_API_KEY.')
    }
    const cfg = await loadInviteConfig(db)
    if (!cfg.fromEmail) {
      throw new HttpsError('failed-precondition', 'Δεν έχει οριστεί «Email αποστολέα» στις Ρυθμίσεις προσκλήσεων.')
    }

    try {
      await sendBrevoEmail(process.env.BREVO_API_KEY, {
        toEmail: to,
        toName: toName || undefined,
        subject,
        html: textToHtml(body),
        fromEmail: cfg.fromEmail,
        fromName: cfg.fromName,
        cc: cfg.ccEmail,
        attachments,
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      logger.warn('[notice-email] send failed', { to, reason: msg.slice(0, 200) })
      throw new HttpsError('internal', msg.slice(0, 200))
    }
    logger.info('[notice-email] sent', { to, attachments: attachments.length })
    return { ok: true }
  },
)
