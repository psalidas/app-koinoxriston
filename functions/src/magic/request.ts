// `requestMagicLink` callable — στέλνει σύνδεσμο εισόδου (magic link) σε
// email ή κινητό. Στέλνεται ΜΟΝΟ σε γνωστούς/ενεργούς χρήστες, χωρίς να
// αποκαλύπτεται αν υπάρχει ο λογαριασμός (πάντα επιστρέφει ok).

import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { logger } from 'firebase-functions/v2'
import { getFirestore } from 'firebase-admin/firestore'
import { loadInviteConfig } from '../invites/send'
import { sendBrevoEmail } from '../invites/brevoClient'
import { sendSmsTo } from '../invites/smsToClient'
import { createMagicLink, identifierType, normalizeIdentifier } from './links'

const LOGIN_TTL_MIN = 60 // ο σύνδεσμος login ισχύει 1 ώρα

export const requestMagicLink = onCall(
  { invoker: 'public' },
  async (request): Promise<{ ok: true }> => {
    try {
      const id = normalizeIdentifier(
        typeof request.data?.identifier === 'string' ? request.data.identifier : '',
      )
      const type = identifierType(id)
      if (!type) throw new HttpsError('invalid-argument', 'Δώστε έγκυρο email ή κινητό.')

      const db = getFirestore()
      const snap = await db.doc(`users/${id}`).get()
      const active = snap.exists && snap.data()?.active !== false
      if (!active) {
        // Δεν αποκαλύπτουμε ότι δεν υπάρχει — σιωπηλή επιτυχία.
        logger.info('[magic] request for unknown/inactive identifier')
        return { ok: true }
      }

      const cfg = await loadInviteConfig(db)
      const link = await createMagicLink(db, id, cfg.appUrl, LOGIN_TTL_MIN)

      if (type === 'email') {
        const key = process.env.BREVO_API_KEY
        if (!key) throw new HttpsError('failed-precondition', 'Λείπει το BREVO_API_KEY.')
        if (!cfg.fromEmail) {
          throw new HttpsError('failed-precondition', 'Δεν έχει οριστεί «Email αποστολέα» στις ρυθμίσεις.')
        }
        await sendBrevoEmail(key, {
          toEmail: id,
          subject: 'Σύνδεσμος εισόδου — Διαχείριση Πολυκατοικίας',
          html:
            '<p>Πατήστε τον παρακάτω σύνδεσμο για να συνδεθείτε (ισχύει 1 ώρα):</p>' +
            `<p><a href="${link}">Είσοδος στην εφαρμογή</a></p>` +
            `<p>Αν δεν ζητήσατε είσοδο, αγνοήστε το μήνυμα.</p>`,
          fromEmail: cfg.fromEmail,
          fromName: cfg.fromName,
        })
      } else {
        const key = process.env.SMSTO_API_KEY
        if (!key) throw new HttpsError('failed-precondition', 'Λείπει το SMSTO_API_KEY.')
        await sendSmsTo(key, {
          to: id,
          message: `Σύνδεσμος εισόδου (ισχύει 1 ώρα): ${link}`,
          sender: cfg.smsSender,
        })
      }
      return { ok: true }
    } catch (e) {
      if (e instanceof HttpsError) throw e
      const msg = e instanceof Error ? e.message : String(e)
      logger.error('[magic] request failed', { error: e instanceof Error ? e.stack ?? msg : msg })
      throw new HttpsError('failed-precondition', msg || 'Αποτυχία αποστολής συνδέσμου.')
    }
  },
)
