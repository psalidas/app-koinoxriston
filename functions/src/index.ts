import { setGlobalOptions } from 'firebase-functions/v2'
import { onDocumentCreated, onDocumentUpdated } from 'firebase-functions/v2/firestore'
import * as admin from 'firebase-admin'

admin.initializeApp()
setGlobalOptions({ region: 'europe-west1', maxInstances: 5 })

const db = admin.firestore()

interface UserDoc {
  name?: string
  role?: string
  buildingIds?: string[]
  apartmentIds?: string[]
  active?: boolean
}

interface StatementRow {
  apartmentId: string
  code: string
  total: number
}

function isEmail(s: string): boolean {
  return /.+@.+\..+/.test(s)
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] as string))
}

async function buildingUsers(buildingId: string): Promise<{ id: string; data: UserDoc }[]> {
  const snap = await db.collection('users').where('buildingIds', 'array-contains', buildingId).get()
  return snap.docs.map((d) => ({ id: d.id, data: d.data() as UserDoc }))
}

/**
 * Enqueue an email for the `firestore-send-email` extension, which watches the
 * `mail` collection and sends via the configured SMTP provider.
 */
async function enqueueMail(to: string[], subject: string, html: string): Promise<void> {
  if (to.length === 0) return
  await db.collection('mail').add({ to, message: { subject, html } })
}

/** New announcement → email all active users of the building with an address. */
export const onAnnouncementCreated = onDocumentCreated('announcements/{id}', async (event) => {
  const ann = event.data?.data()
  if (!ann) return
  const users = await buildingUsers(ann.buildingId as string)
  const to = users.filter((u) => u.data.active !== false && isEmail(u.id)).map((u) => u.id)
  const html = `<h2>${escapeHtml(ann.title)}</h2><p>${escapeHtml(ann.body || '').replace(/\n/g, '<br>')}</p>`
  await enqueueMail(to, `Ανακοίνωση: ${ann.title}`, html)
})

/** Statement issued (draft → issued) → email each owner/resident their amount. */
export const onStatementIssued = onDocumentUpdated('statements/{id}', async (event) => {
  const before = event.data?.before.data()
  const after = event.data?.after.data()
  if (!after) return
  if (before?.status === 'issued' || after.status !== 'issued') return

  const users = await buildingUsers(after.buildingId as string)
  const rows: StatementRow[] = (after.rows as StatementRow[]) || []
  const periodLabel = (after.periodLabel as string) || (after.period as string)

  for (const u of users) {
    if (u.data.active === false || !isEmail(u.id)) continue
    const aptIds = u.data.apartmentIds || []
    const mine = rows.filter((r) => aptIds.includes(r.apartmentId))
    if (mine.length === 0) continue
    const total = mine.reduce((s, r) => s + (r.total || 0), 0)
    const lines = mine.map((r) => `Διαμ. ${escapeHtml(r.code)}: ${r.total.toFixed(2)} €`).join('<br>')
    const html =
      `<p>Εκδόθηκαν τα κοινόχρηστα για την περίοδο <b>${escapeHtml(periodLabel)}</b>.</p>` +
      `<p>${lines}</p><p><b>Πληρωτέο σύνολο: ${total.toFixed(2)} €</b></p>` +
      `<p>Δείτε το ειδοποιητήριο στην εφαρμογή.</p>`
    await enqueueMail([u.id], `Κοινόχρηστα ${periodLabel}`, html)
  }
})
