// SMS.to transactional SMS API (ίδιο pattern με το crm-crowdpolicy).
//
// REST: POST https://api.sms.to/sms/send
//   Headers: Authorization: Bearer <API_KEY>, Content-Type: application/json
//   Body:    { message, to, sender_id, bypass_optout }
//   Success: 2xx με { success: true, ... } (success=false = λογικό σφάλμα)

import { logger } from 'firebase-functions/v2'

const SMS_TO_ENDPOINT = 'https://api.sms.to/sms/send'

interface SmsToResponse {
  success?: boolean
  message?: string
  error?: string
}

export interface SmsToParams {
  /** Παραλήπτης σε E.164 (π.χ. "+306912345678"). */
  to: string
  message: string
  /** Alphanumeric sender id (≤11 χαρ.) — μη-αλφαριθμητικά αφαιρούνται. */
  sender: string
}

export async function sendSmsTo(apiKey: string, params: SmsToParams): Promise<void> {
  // Το SMS.to δέχεται sender_id μόνο alphanumeric + κενά, έως 11 χαρακτήρες.
  const senderId = (params.sender.replace(/[^A-Za-z0-9 ]/g, '').trim() || 'Info').slice(0, 11)
  const body = {
    message: params.message,
    to: params.to,
    sender_id: senderId,
    bypass_optout: true,
  }

  let resp: Response
  try {
    resp = await fetch(SMS_TO_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    throw new Error(`SMS.to network error: ${msg}`)
  }

  const text = await resp.text()
  let json: SmsToResponse | null = null
  try {
    json = text ? (JSON.parse(text) as SmsToResponse) : null
  } catch {
    // non-JSON — κρατάμε το raw text για debug
  }

  if (!resp.ok) {
    const reason = json?.message || json?.error || `http ${resp.status}`
    logger.warn('[invite] sms.to rejected', { to: params.to, status: resp.status, reason })
    throw new Error(`SMS.to HTTP ${resp.status}: ${String(reason).slice(0, 300)}`)
  }
  if (json && json.success === false) {
    throw new Error(json.message || json.error || 'SMS.to send failed')
  }
  logger.info('[invite] sms sent', { to: params.to, senderId })
}
