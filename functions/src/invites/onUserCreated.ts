// Πρόσκληση νέου χρήστη: όταν ο διαχειριστής προσθέτει χρήστη
// (`users/{userId}`), στέλνουμε αυτόματα πρόσκληση εισόδου.
//
// Κανάλι ανάλογα με το ΚΥΡΙΟ αναγνωριστικό (= το doc id):
//   • email  → Brevo transactional email (Secret: BREVO_API_KEY)
//   • κινητό → SMS.to (Secret: SMSTO_API_KEY)
//
// Μη-ευαίσθητο config στο Firestore `settings/invites` (appUrl, fromEmail,
// fromName, smsSender, enabled). Το `fromEmail` ΠΡΕΠΕΙ να είναι
// επιβεβαιωμένος αποστολέας στο Brevo. Τα API keys μένουν στο Secret
// Manager και δεν περνούν ποτέ από Firestore/frontend.

import { onDocumentCreated } from 'firebase-functions/v2/firestore'
import { defineSecret } from 'firebase-functions/params'
import { logger } from 'firebase-functions/v2'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import { sendBrevoEmail } from './brevoClient'
import { sendSmsTo } from './smsToClient'

const BREVO_API_KEY = defineSecret('BREVO_API_KEY')
const SMSTO_API_KEY = defineSecret('SMSTO_API_KEY')

const DEFAULT_APP_URL = 'https://app-koinoxriston.web.app'
const DEFAULT_FROM_NAME = 'Διαχείριση Πολυκατοικίας'
const DEFAULT_SMS_SENDER = 'Polykatoikia'

interface InviteConfig {
  enabled: boolean
  appUrl: string
  fromEmail: string
  fromName: string
  smsSender: string
}

async function loadConfig(db: FirebaseFirestore.Firestore): Promise<InviteConfig> {
  try {
    const snap = await db.doc('settings/invites').get()
    const d = (snap.exists ? snap.data() : {}) ?? {}
    const str = (v: unknown, fallback: string) =>
      typeof v === 'string' && v.trim() ? v.trim() : fallback
    return {
      enabled: d.enabled !== false,
      appUrl: str(d.appUrl, DEFAULT_APP_URL),
      fromEmail: typeof d.fromEmail === 'string' ? d.fromEmail.trim() : '',
      fromName: str(d.fromName, DEFAULT_FROM_NAME),
      smsSender: str(d.smsSender, DEFAULT_SMS_SENDER),
    }
  } catch {
    return {
      enabled: true,
      appUrl: DEFAULT_APP_URL,
      fromEmail: '',
      fromName: DEFAULT_FROM_NAME,
      smsSender: DEFAULT_SMS_SENDER,
    }
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c] as string)
}

const isEmail = (id: string) => id.includes('@')
const isPhone = (id: string) => /^\+?\d[\d\s]{6,}$/.test(id)

export const onUserCreatedInvite = onDocumentCreated(
  { document: 'users/{userId}', secrets: [BREVO_API_KEY, SMSTO_API_KEY] },
  async (event) => {
    const userId = event.params.userId
    const data = event.data?.data()
    if (!data) return
    if (data.active === false) {
      logger.info('[invite] skip: inactive account', { userId })
      return
    }
    if (data.invitedAt) return // ήδη προσκεκλημένος (ασφάλεια)

    const db = getFirestore()
    const cfg = await loadConfig(db)
    if (!cfg.enabled) {
      logger.info('[invite] disabled via settings/invites')
      return
    }

    const name = typeof data.name === 'string' ? data.name : ''
    const url = cfg.appUrl
    const markInvited = (channel: 'email' | 'sms') =>
      event.data!.ref.set({ invitedAt: Timestamp.now(), inviteChannel: channel }, { merge: true })

    try {
      if (isEmail(userId)) {
        if (!cfg.fromEmail) {
          logger.warn('[invite] no fromEmail in settings/invites — email skipped', { userId })
          return
        }
        const greeting = name ? `Γεια σας ${escapeHtml(name)},` : 'Γεια σας,'
        const html =
          `<p>${greeting}</p>` +
          `<p>Σας δόθηκε πρόσβαση στην εφαρμογή <b>Διαχείριση Πολυκατοικίας</b>.</p>` +
          `<p>Μπείτε εδώ και συνδεθείτε με αυτό το email (Google ή σύνδεσμος εισόδου):</p>` +
          `<p><a href="${url}">${url}</a></p>` +
          `<p>—<br>Ο διαχειριστής της πολυκατοικίας</p>`
        await sendBrevoEmail(BREVO_API_KEY.value(), {
          toEmail: userId,
          toName: name || undefined,
          subject: 'Πρόσκληση — Διαχείριση Πολυκατοικίας',
          html,
          fromEmail: cfg.fromEmail,
          fromName: cfg.fromName,
        })
        await markInvited('email')
      } else if (isPhone(userId)) {
        const to = userId.startsWith('+') ? userId : `+${userId.replace(/\s+/g, '')}`
        const message =
          `Σας δόθηκε πρόσβαση στη Διαχείριση Πολυκατοικίας. ` +
          `Συνδεθείτε με το κινητό σας: ${url}`
        await sendSmsTo(SMSTO_API_KEY.value(), { to, message, sender: cfg.smsSender })
        await markInvited('sms')
      } else {
        logger.warn('[invite] identifier is neither email nor phone', { userId })
      }
    } catch (e) {
      // Best-effort: δεν ρίχνουμε το function· καταγράφουμε για διάγνωση και
      // αφήνουμε το invitedAt κενό ώστε να μπορεί να ξαναδοκιμαστεί χειροκίνητα.
      logger.error('[invite] send failed', {
        userId,
        error: e instanceof Error ? e.message : String(e),
      })
    }
  },
)
