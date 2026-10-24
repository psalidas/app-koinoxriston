// AI εξαγωγή κινήσεων από αντίγραφο λογαριασμού (extré) — Claude vision.
//
// Callable: δέχεται PDF/εικόνα extré και επιστρέφει λίστα κινήσεων
// {date, description, amount} ώστε να αντιστοιχιστούν με πληρωμές ενοίκων.

import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { logger } from 'firebase-functions/v2'
import Anthropic from '@anthropic-ai/sdk'

const MODEL = 'claude-haiku-4-5'

type ImageMediaType = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'
type MediaType = ImageMediaType | 'application/pdf'
const ALLOWED_IMAGE: ImageMediaType[] = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const ALLOWED_MEDIA: MediaType[] = [...ALLOWED_IMAGE, 'application/pdf']

const MAX_IMAGE_BASE64_LEN = 6 * 1024 * 1024
const MAX_PDF_BASE64_LEN = 12 * 1024 * 1024

interface Txn {
  date?: string
  description?: string
  amount?: number
}

const EXTRACT_TOOL = {
  name: 'extract_transactions',
  description: 'Καταγράφει όλες τις κινήσεις ενός τραπεζικού αντιγράφου (extré).',
  input_schema: {
    type: 'object' as const,
    properties: {
      transactions: {
        type: 'array',
        description: 'Όλες οι γραμμές κινήσεων, με τη σειρά που εμφανίζονται.',
        items: {
          type: 'object',
          properties: {
            date: { type: 'string', description: 'Ημ/νία κίνησης σε μορφή ISO YYYY-MM-DD.' },
            description: { type: 'string', description: 'Η πλήρης περιγραφή/αιτιολογία της κίνησης.' },
            amount: {
              type: 'number',
              description: 'Ποσό κίνησης. ΘΕΤΙΚΟ για πιστώσεις/καταθέσεις (χρήματα που μπαίνουν), ΑΡΝΗΤΙΚΟ για χρεώσεις/αναλήψεις.',
            },
          },
          required: ['amount'],
        },
      },
    },
    required: ['transactions'],
  },
}

export const ocrBankStatement = onCall(
  { invoker: 'public' },
  async (request): Promise<{ transactions: Txn[] }> => {
    const email = request.auth?.token?.email as string | undefined
    if (!email) throw new HttpsError('unauthenticated', 'Δεν είστε συνδεδεμένος.')

    const data = (request.data ?? {}) as { imageBase64?: string; mediaType?: string }
    const imageBase64 = (data.imageBase64 ?? '').trim()
    const mediaType = (data.mediaType ?? '') as MediaType
    if (!imageBase64) throw new HttpsError('invalid-argument', 'Λείπει το αρχείο.')
    if (!ALLOWED_MEDIA.includes(mediaType)) {
      throw new HttpsError('invalid-argument', 'Μη υποστηριζόμενος τύπος (μόνο εικόνα ή PDF).')
    }
    const isPdf = mediaType === 'application/pdf'
    if (imageBase64.length > (isPdf ? MAX_PDF_BASE64_LEN : MAX_IMAGE_BASE64_LEN)) {
      throw new HttpsError('invalid-argument', 'Το αρχείο είναι πολύ μεγάλο για ανάλυση.')
    }
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) throw new HttpsError('failed-precondition', 'Το AI δεν έχει ρυθμιστεί (λείπει το ANTHROPIC_API_KEY).')

    const client = new Anthropic({ apiKey })
    const fileBlock = isPdf
      ? { type: 'document' as const, source: { type: 'base64' as const, media_type: 'application/pdf' as const, data: imageBase64 } }
      : { type: 'image' as const, source: { type: 'base64' as const, media_type: mediaType as ImageMediaType, data: imageBase64 } }

    let message
    try {
      message = await client.messages.create({
        model: MODEL,
        max_tokens: 4096,
        tools: [EXTRACT_TOOL],
        tool_choice: { type: 'tool', name: 'extract_transactions' },
        messages: [
          {
            role: 'user',
            content: [
              fileBlock,
              {
                type: 'text',
                text:
                  'Διάβασε αυτό το τραπεζικό αντίγραφο κινήσεων (extré) και κάλεσε το extract_transactions ' +
                  'με ΟΛΕΣ τις κινήσεις. Για κάθε κίνηση δώσε ημερομηνία (ISO), πλήρη περιγραφή και ποσό. ' +
                  'Το ποσό θετικό για πιστώσεις (καταθέσεις/εισερχόμενα) και αρνητικό για χρεώσεις/προμήθειες. ' +
                  'Μη συμπεριλάβεις γραμμές υπολοίπου ή επικεφαλίδες.',
              },
            ],
          },
        ],
      })
    } catch (err) {
      logger.error('ocrBankStatement: Anthropic call failed', { err: err instanceof Error ? err.message : String(err) })
      throw new HttpsError('internal', 'Αποτυχία ανάλυσης extré.')
    }

    const toolBlock = message.content.find((b) => b.type === 'tool_use')
    if (!toolBlock || toolBlock.type !== 'tool_use') return { transactions: [] }
    const out = toolBlock.input as { transactions?: unknown }
    const raw = Array.isArray(out.transactions) ? out.transactions : []
    const transactions: Txn[] = raw
      .map((t) => {
        const o = t as Record<string, unknown>
        const amount = typeof o.amount === 'number' ? Math.round(o.amount * 100) / 100 : undefined
        const date = typeof o.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(o.date) ? o.date : undefined
        const description = typeof o.description === 'string' ? o.description.trim().slice(0, 300) : ''
        return { date, description, amount }
      })
      .filter((t) => typeof t.amount === 'number')

    logger.info('ocrBankStatement ok', { email, count: transactions.length })
    return { transactions }
  },
)
