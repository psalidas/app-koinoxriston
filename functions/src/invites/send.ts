// Κοινή λογική αποστολής πρόσκλησης — χρησιμοποιείται και από τον trigger
// (onUserCreated) και από το callable (resendInvite).
//
// Κανάλι ανάλογα με το ΚΥΡΙΟ αναγνωριστικό (= doc id του χρήστη):
//   • email  → Brevo transactional email  (env: BREVO_API_KEY)
//   • κινητό → SMS.to                       (env: SMSTO_API_KEY)
//
// Τα API keys έρχονται από GitHub Secrets → γράφονται ως env vars των
// functions στο CI (functions/.env). Μη-ευαίσθητο config: Firestore
// `settings/invites`.

import { logger } from 'firebase-functions/v2'
import { Timestamp } from 'firebase-admin/firestore'
import { sendBrevoEmail } from './brevoClient'
import { sendSmsTo } from './smsToClient'
import { createMagicLink } from '../magic/links'

const INVITE_TTL_MIN = 60 * 24 * 7 // ο σύνδεσμος πρόσκλησης ισχύει 7 ημέρες

export const DEFAULT_APP_URL = 'https://app-koinoxriston.web.app'
const DEFAULT_FROM_NAME = 'Διαχείριση Πολυκατοικίας'
const DEFAULT_SMS_SENDER = 'Diaxeirisi' // ≤11 λατινικά (όριο sms.to)
// Προεπιλεγμένο CC σε κάθε εξερχόμενο email (μπορεί να αλλάξει από τις
// Ρυθμίσεις προσκλήσεων· κενή τιμή = χωρίς CC).
export const DEFAULT_CC_EMAIL = 'michael@crowdpolicy.com'

export interface InviteConfig {
  enabled: boolean
  appUrl: string
  fromEmail: string
  fromName: string
  smsSender: string
  ccEmail: string
}

export async function loadInviteConfig(db: FirebaseFirestore.Firestore): Promise<InviteConfig> {
  const str = (v: unknown, fallback: string) =>
    typeof v === 'string' && v.trim() ? v.trim() : fallback
  try {
    const snap = await db.doc('settings/invites').get()
    const d = (snap.exists ? snap.data() : {}) ?? {}
    return {
      enabled: d.enabled !== false,
      appUrl: str(d.appUrl, DEFAULT_APP_URL),
      fromEmail: typeof d.fromEmail === 'string' ? d.fromEmail.trim() : '',
      fromName: str(d.fromName, DEFAULT_FROM_NAME),
      smsSender: str(d.smsSender, DEFAULT_SMS_SENDER),
      // Αν το πεδίο λείπει → προεπιλογή· αν είναι ρητά κενό → χωρίς CC.
      ccEmail: typeof d.ccEmail === 'string' ? d.ccEmail.trim() : DEFAULT_CC_EMAIL,
    }
  } catch {
    return {
      enabled: true,
      appUrl: DEFAULT_APP_URL,
      fromEmail: '',
      fromName: DEFAULT_FROM_NAME,
      smsSender: DEFAULT_SMS_SENDER,
      ccEmail: DEFAULT_CC_EMAIL,
    }
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c] as string)
}

const isEmail = (id: string) => id.includes('@')
const isPhone = (id: string) => /^\+?\d[\d\s]{6,}$/.test(id)

/**
 * Στέλνει πρόσκληση στον χρήστη `userId` και, σε επιτυχία, γράφει
 * `invitedAt`/`inviteChannel` πίσω στο doc. Ρίχνει Error με ανθρωποαναγνώσιμο
 * μήνυμα σε αποτυχία (λείπον key/config, απόρριψη παρόχου, άγνωστο id).
 */
export async function sendInvite(
  db: FirebaseFirestore.Firestore,
  userId: string,
  data: FirebaseFirestore.DocumentData,
  cfg: InviteConfig,
): Promise<'email' | 'sms'> {
  const name = typeof data.name === 'string' ? data.name : ''
  const mark = (channel: 'email' | 'sms') =>
    db.doc(`users/${userId}`).set({ invitedAt: Timestamp.now(), inviteChannel: channel }, { merge: true })

  if (isEmail(userId)) {
    const key = process.env.BREVO_API_KEY
    if (!key) throw new Error('Λείπει το BREVO_API_KEY (GitHub secret / functions env).')
    if (!cfg.fromEmail) {
      throw new Error('Δεν έχει οριστεί «Email αποστολέα» στις Ρυθμίσεις προσκλήσεων.')
    }
    const link = await createMagicLink(db, userId, cfg.appUrl, INVITE_TTL_MIN)
    const greeting = name ? `Γεια σας ${escapeHtml(name)},` : 'Γεια σας,'
    const html =
      `<p>${greeting}</p>` +
      `<p>Σας δόθηκε πρόσβαση στην εφαρμογή <b>Διαχείριση Πολυκατοικίας</b>.</p>` +
      `<p>Πατήστε για να μπείτε απευθείας με ένα κλικ (ο σύνδεσμος ισχύει 7 ημέρες):</p>` +
      `<p><a href="${link}">Είσοδος στην εφαρμογή</a></p>` +
      `<p style="color:#666;font-size:13px">…ή <a href="${link}&setpw=1">ορίστε κωδικό πρόσβασης</a> ` +
      `για να μπαίνετε στο εξής με email &amp; κωδικό.</p>` +
      `<p>—<br>Ο διαχειριστής της πολυκατοικίας</p>`
    await sendBrevoEmail(key, {
      toEmail: userId,
      toName: name || undefined,
      subject: 'Πρόσκληση — Διαχείριση Πολυκατοικίας',
      html,
      fromEmail: cfg.fromEmail,
      fromName: cfg.fromName,
      cc: cfg.ccEmail,
    })
    await mark('email')
    return 'email'
  }

  if (isPhone(userId)) {
    const key = process.env.SMSTO_API_KEY
    if (!key) throw new Error('Λείπει το SMSTO_API_KEY (GitHub secret / functions env).')
    const to = userId.startsWith('+') ? userId : `+${userId.replace(/\s+/g, '')}`
    const link = await createMagicLink(db, userId, cfg.appUrl, INVITE_TTL_MIN)
    const message = `Πρόσκληση στη Διαχείριση Πολυκατοικίας. Είσοδος (7 ημέρες): ${link}`
    await sendSmsTo(key, { to, message, sender: cfg.smsSender })
    await mark('sms')
    logger.info('[invite] sms invite sent', { userId })
    return 'sms'
  }

  throw new Error('Το αναγνωριστικό του χρήστη δεν είναι email ούτε κινητό.')
}
