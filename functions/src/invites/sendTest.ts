// `sendTestInvite` callable — δοκιμαστική αποστολή email/SMS σε διεύθυνση/αριθμό
// της επιλογής του διαχειριστή, για επαλήθευση της ρύθμισης (Brevo / sms.to).
// Δεν αγγίζει κανένα user doc. Auth: μόνο διαχειριστές.

import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { logger } from 'firebase-functions/v2'
import { getFirestore } from 'firebase-admin/firestore'
import { loadInviteConfig } from './send'
import { requireManager } from './auth'
import { sendBrevoEmail } from './brevoClient'
import { sendSmsTo } from './smsToClient'

export const sendTestInvite = onCall(
  { invoker: 'public' },
  async (request): Promise<{ ok: true; channel: 'email' | 'sms' }> => {
    const db = getFirestore()
    await requireManager(db, request.auth as { token?: { email?: string } } | undefined)

    const channel = request.data?.channel
    const to = typeof request.data?.to === 'string' ? request.data.to.trim() : ''
    if (channel !== 'email' && channel !== 'sms') {
      throw new HttpsError('invalid-argument', 'Άγνωστο κανάλι (email/sms).')
    }
    if (!to) throw new HttpsError('invalid-argument', 'Λείπει ο παραλήπτης.')

    const cfg = await loadInviteConfig(db)

    try {
      if (channel === 'email') {
        const key = process.env.BREVO_API_KEY
        if (!key) throw new Error('Λείπει το BREVO_API_KEY (GitHub secret / functions env).')
        if (!cfg.fromEmail) {
          throw new Error('Δεν έχει οριστεί «Email αποστολέα» στις Ρυθμίσεις προσκλήσεων.')
        }
        await sendBrevoEmail(key, {
          toEmail: to,
          subject: 'Δοκιμή — Διαχείριση Πολυκατοικίας',
          html:
            '<p>Δοκιμαστικό email από τη Διαχείριση Πολυκατοικίας.</p>' +
            '<p>Αν το βλέπετε, η ρύθμιση email (Brevo) λειτουργεί. ✅</p>',
          fromEmail: cfg.fromEmail,
          fromName: cfg.fromName,
        })
        return { ok: true, channel: 'email' }
      }

      const key = process.env.SMSTO_API_KEY
      if (!key) throw new Error('Λείπει το SMSTO_API_KEY (GitHub secret / functions env).')
      const phone = to.startsWith('+') ? to : `+${to.replace(/\s+/g, '')}`
      await sendSmsTo(key, {
        to: phone,
        message: 'Δοκιμαστικό SMS από τη Διαχείριση Πολυκατοικίας. Η ρύθμιση SMS λειτουργεί.',
        sender: cfg.smsSender,
      })
      return { ok: true, channel: 'sms' }
    } catch (e) {
      if (e instanceof HttpsError) throw e
      const msg = e instanceof Error ? e.message : String(e)
      logger.error('[invite] test failed', { channel, error: e instanceof Error ? e.stack ?? msg : msg })
      throw new HttpsError('failed-precondition', msg || 'Αποτυχία δοκιμής.')
    }
  },
)
