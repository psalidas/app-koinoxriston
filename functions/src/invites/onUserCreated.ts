// Αυτόματη πρόσκληση όταν ο διαχειριστής προσθέτει χρήστη
// (`users/{userId}` onCreate). Κανάλι ανάλογα με το κύριο αναγνωριστικό —
// βλ. `send.ts`. API keys από functions env (GitHub Secrets → CI).

import { onDocumentCreated } from 'firebase-functions/v2/firestore'
import { logger } from 'firebase-functions/v2'
import { getFirestore } from 'firebase-admin/firestore'
import { loadInviteConfig, sendInvite } from './send'

export const onUserCreatedInvite = onDocumentCreated('users/{userId}', async (event) => {
  const userId = event.params.userId
  const data = event.data?.data()
  if (!data) return
  if (data.active === false) {
    logger.info('[invite] skip: inactive account', { userId })
    return
  }
  if (data.invitedAt) return // ήδη προσκεκλημένος

  const db = getFirestore()
  const cfg = await loadInviteConfig(db)
  if (!cfg.enabled) {
    logger.info('[invite] disabled via settings/invites')
    return
  }

  try {
    const channel = await sendInvite(db, userId, data, cfg)
    logger.info('[invite] auto-sent', { userId, channel })
  } catch (e) {
    // Best-effort: δεν ρίχνουμε· το invitedAt μένει κενό ώστε ο διαχειριστής
    // να μπορεί να κάνει «Επαναποστολή πρόσκλησης» από τη λίστα χρηστών.
    logger.error('[invite] auto-send failed', {
      userId,
      error: e instanceof Error ? e.message : String(e),
    })
  }
})
