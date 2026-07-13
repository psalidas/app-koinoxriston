// Brevo (πρώην Sendinblue) transactional email API.
//
// REST: POST https://api.brevo.com/v3/smtp/email
//   Headers: api-key: <BREVO_API_KEY>, Content-Type: application/json
//   Body:    { sender:{email,name}, to:[{email,name}], subject, htmlContent }
//
// Ο αποστολέας (`fromEmail`) ΠΡΕΠΕΙ να είναι επιβεβαιωμένος στο Brevo
// (Senders & IP), αλλιώς το API απορρίπτει με 400.

import { logger } from 'firebase-functions/v2'

const BREVO_ENDPOINT = 'https://api.brevo.com/v3/smtp/email'

export interface BrevoEmailParams {
  toEmail: string
  toName?: string
  subject: string
  html: string
  fromEmail: string
  fromName: string
}

export async function sendBrevoEmail(apiKey: string, params: BrevoEmailParams): Promise<void> {
  const body = {
    sender: { email: params.fromEmail, name: params.fromName },
    to: [params.toName ? { email: params.toEmail, name: params.toName } : { email: params.toEmail }],
    subject: params.subject,
    htmlContent: params.html,
  }

  let resp: Response
  try {
    resp = await fetch(BREVO_ENDPOINT, {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    throw new Error(`Brevo network error: ${msg}`)
  }

  if (!resp.ok) {
    const text = await resp.text().catch(() => '')
    logger.warn('[invite] brevo rejected', { to: params.toEmail, status: resp.status, body: text.slice(0, 300) })
    throw new Error(`Brevo HTTP ${resp.status}: ${text.slice(0, 300)}`)
  }
  logger.info('[invite] email sent', { to: params.toEmail })
}
