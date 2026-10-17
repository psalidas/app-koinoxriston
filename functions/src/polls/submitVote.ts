// `submitVote` callable — καταχώρηση ψήφου server-side ώστε:
//  • να υπολογίζεται το βάρος αξιόπιστα (όχι από τον client),
//  • να μην αλλάζει ψήφος (μία ανά ψηφοφόρο),
//  • να καταγράφονται μεταδεδομένα (IP, browser) που δεν υπάρχουν client-side,
//  • να στέλνεται email στον ψηφοφόρο (αν έχει) και στους διαχειριστές,
//  • να γράφεται εγγραφή audit log.

import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { logger } from 'firebase-functions/v2'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { loadInviteConfig } from '../invites/send'

const isEmail = (s: string) => /.+@.+\..+/.test(s)
const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] as string))
const str = (v: unknown) => (typeof v === 'string' ? v.slice(0, 200) : '')

export const submitVote = onCall(
  { invoker: 'public' },
  async (request): Promise<{ ok: true; weight: number }> => {
    const db = getFirestore()
    const token = request.auth?.token as Record<string, unknown> | undefined
    const voterId = String(token?.identifier || token?.email || token?.phone_number || '')
    if (!voterId) throw new HttpsError('unauthenticated', 'Δεν είστε συνδεδεμένος.')

    const pollId = String(request.data?.pollId || '')
    const option = Number(request.data?.option)
    const clientMeta = (request.data?.meta ?? {}) as Record<string, unknown>
    if (!pollId || !Number.isInteger(option)) throw new HttpsError('invalid-argument', 'Μη έγκυρα στοιχεία.')

    const pollSnap = await db.doc(`polls/${pollId}`).get()
    if (!pollSnap.exists) throw new HttpsError('not-found', 'Η ψηφοφορία δεν βρέθηκε.')
    const poll = pollSnap.data() as {
      status?: string; options?: string[]; buildingId?: string; weightMode?: string; scaleKey?: string; question?: string
    }
    if (poll.status !== 'open') throw new HttpsError('failed-precondition', 'Η ψηφοφορία δεν είναι ανοιχτή.')
    const options = poll.options ?? []
    if (option < 0 || option >= options.length) throw new HttpsError('invalid-argument', 'Μη έγκυρη επιλογή.')
    const buildingId = String(poll.buildingId || '')

    const userSnap = await db.doc(`users/${voterId}`).get()
    if (!userSnap.exists) throw new HttpsError('permission-denied', 'Άγνωστος χρήστης.')
    const user = userSnap.data() as { name?: string; role?: string; apartmentIds?: string[] }
    const apartmentIds = user.apartmentIds ?? []
    if (apartmentIds.length === 0) throw new HttpsError('failed-precondition', 'Δεν υπάρχει συνδεδεμένο διαμέρισμα.')

    // Μία ψήφος ανά ψηφοφόρο — καμία αλλαγή.
    const voteRef = db.doc(`votes/${pollId}__${voterId}`)
    if ((await voteRef.get()).exists) throw new HttpsError('already-exists', 'Έχετε ήδη ψηφίσει.')

    // Υπολογισμός βάρους από τα διαμερίσματα (server-authoritative).
    const scaleKey = poll.scaleKey || 'genika'
    const aptSnaps = await Promise.all(apartmentIds.map((aid) => db.doc(`apartments/${aid}`).get()))
    const apts = aptSnaps
      .filter((s) => s.exists && (s.data() as { buildingId?: string }).buildingId === buildingId)
      .map((s) => ({ id: s.id, data: s.data() as { code?: string; millesimes?: Record<string, number> } }))
    let weight = 0
    if (poll.weightMode === 'perUser') weight = apts.length > 0 ? 1 : 0
    else if (poll.weightMode === 'perApartment') weight = apts.length
    else weight = apts.reduce((s, a) => s + Number(a.data.millesimes?.[scaleKey] || 0), 0)
    if (weight <= 0) throw new HttpsError('failed-precondition', 'Δεν έχετε δικαίωμα ψήφου σε αυτή την ψηφοφορία.')

    const rawIp = request.rawRequest?.ip || (request.rawRequest?.headers?.['x-forwarded-for'] as string) || ''
    const meta = {
      ip: String(rawIp).split(',')[0].trim(),
      userAgent: String(request.rawRequest?.headers?.['user-agent'] || '').slice(0, 300),
      platform: str(clientMeta.platform),
      language: str(clientMeta.language),
      timezone: str(clientMeta.timezone),
      screen: str(clientMeta.screen),
    }

    const voterName = user.name || voterId
    await voteRef.set({
      buildingId,
      pollId,
      voterId,
      voterName,
      option,
      weight,
      apartmentIds: apts.map((a) => a.id),
      meta,
      createdAt: FieldValue.serverTimestamp(),
    })

    // Audit log (server-side, αξιόπιστο).
    try {
      await db.collection('auditLogs').add({
        buildingId,
        userEmail: voterId,
        userName: voterName,
        action: 'vote',
        entity: 'poll',
        entityId: poll.question || pollId,
        after: { option: options[option], weight },
        context: meta,
        timestamp: FieldValue.serverTimestamp(),
      })
    } catch (e) {
      logger.warn('[vote] audit failed', { err: e instanceof Error ? e.message : String(e) })
    }

    // Email στον ψηφοφόρο (αν έχει) + στους διαχειριστές.
    try {
      const uSnap = await db.collection('users').where('buildingIds', 'array-contains', buildingId).get()
      const managerEmails = uSnap.docs
        .map((d) => ({ id: d.id, data: d.data() as { role?: string } }))
        .filter((u) => (u.data.role === 'admin' || u.data.role === 'manager') && isEmail(u.id))
        .map((u) => u.id)
      const to = new Set<string>()
      if (isEmail(voterId)) to.add(voterId)
      managerEmails.forEach((m) => to.add(m))
      if (to.size > 0) {
        let cc = ''
        try { cc = (await loadInviteConfig(db)).ccEmail } catch { /* ignore */ }
        const codes = apts.map((a) => a.data.code || '').filter(Boolean).join(', ')
        const html =
          `<h3>Καταχώρηση ψήφου</h3>` +
          `<p><b>Ψηφοφορία:</b> ${esc(poll.question || '')}</p>` +
          `<p><b>Ψηφοφόρος:</b> ${esc(voterName)}${codes ? ` (${esc(codes)})` : ''}</p>` +
          `<p><b>Ψήφος:</b> ${esc(options[option] || '')}</p>` +
          `<p><b>Βάρος:</b> ${weight}</p>` +
          `<p style="color:#888;font-size:12px">IP: ${esc(meta.ip)}<br>${esc(meta.userAgent)}</p>`
        const message: Record<string, unknown> = { subject: `Ψήφος: ${poll.question || ''}`, html }
        const list = Array.from(to)
        const ccAddr = cc.trim()
        if (ccAddr && !(list.length === 1 && list[0].toLowerCase() === ccAddr.toLowerCase())) message.cc = ccAddr
        await db.collection('mail').add({ to: list, message })
      }
    } catch (e) {
      logger.warn('[vote] email failed', { err: e instanceof Error ? e.message : String(e) })
    }

    logger.info('[vote] recorded', { pollId, voterId, weight })
    return { ok: true, weight }
  },
)
