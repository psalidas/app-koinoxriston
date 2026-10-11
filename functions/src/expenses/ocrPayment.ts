// AI προσυμπλήρωση απόδειξης/εντολής πληρωμής με Claude vision (Haiku 4.5).
//
// Callable: δέχεται εικόνα/PDF απόδειξης πληρωμής (base64) και επιστρέφει
// δομημένα πεδία (ποσό, ημ/νία, τρόπος, αιτιολογία, καταθέτης) για να
// προσυμπληρωθεί η φόρμα «Νέα πληρωμή». API key από env `ANTHROPIC_API_KEY`.

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

type Method = 'cash' | 'bank' | 'card' | 'iris' | 'other'

interface PaymentOcrResult {
  amount?: number
  date?: string // ISO YYYY-MM-DD
  method?: Method
  reference?: string // αιτιολογία πληρωμής
  payerName?: string // ονοματεπώνυμο καταθέτη/χρεούμενου
}

const EXTRACT_TOOL = {
  name: 'extract_payment',
  description: 'Καταγράφει τα δομημένα πεδία μιας απόδειξης/εντολής πληρωμής κοινοχρήστων.',
  input_schema: {
    type: 'object' as const,
    properties: {
      amount: { type: 'number', description: 'Ποσό πληρωμής (EUR).' },
      date: { type: 'string', description: 'Ημερομηνία εκτέλεσης/συναλλαγής σε μορφή ISO YYYY-MM-DD.' },
      method: {
        type: 'string',
        enum: ['cash', 'bank', 'card', 'iris', 'other'],
        description:
          'Τρόπος πληρωμής: bank=τραπεζική μεταφορά/κατάθεση/έμβασμα, card=κάρτα, ' +
          'iris=IRIS/άμεση πληρωμή, cash=μετρητά, other=άλλο.',
      },
      reference: {
        type: 'string',
        description: 'Η αιτιολογία πληρωμής (αιτιολογία αποστολέα/παραλήπτη) όπως αναγράφεται.',
      },
      payerName: {
        type: 'string',
        description: 'Ονοματεπώνυμο αυτού που πληρώνει/χρεώνεται (καταθέτης/δικαιούχος χρέωσης).',
      },
    },
    required: [],
  },
}

export const ocrPayment = onCall(
  { invoker: 'public' },
  async (request): Promise<PaymentOcrResult> => {
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
    if (!apiKey) {
      throw new HttpsError('failed-precondition', 'Το AI δεν έχει ρυθμιστεί (λείπει το ANTHROPIC_API_KEY).')
    }

    const client = new Anthropic({ apiKey })

    const fileBlock = isPdf
      ? {
          type: 'document' as const,
          source: { type: 'base64' as const, media_type: 'application/pdf' as const, data: imageBase64 },
        }
      : {
          type: 'image' as const,
          source: { type: 'base64' as const, media_type: mediaType as ImageMediaType, data: imageBase64 },
        }

    let message
    try {
      message = await client.messages.create({
        model: MODEL,
        max_tokens: 1024,
        tools: [EXTRACT_TOOL],
        tool_choice: { type: 'tool', name: 'extract_payment' },
        messages: [
          {
            role: 'user',
            content: [
              fileBlock,
              {
                type: 'text',
                text:
                  'Διάβασε αυτή την απόδειξη/εντολή πληρωμής κοινοχρήστων και κάλεσε το εργαλείο ' +
                  'extract_payment με όσα πεδία διαβάζεις με βεβαιότητα. Το amount είναι το ποσό ' +
                  'της πληρωμής. Η reference είναι η αιτιολογία. Ο payerName είναι αυτός που πληρώνει ' +
                  '(χρεώνεται ο λογαριασμός του), όχι ο δικαιούχος/παραλήπτης. Άφησε κενό ό,τι δεν φαίνεται.',
              },
            ],
          },
        ],
      })
    } catch (err) {
      logger.error('ocrPayment: Anthropic call failed', { err: err instanceof Error ? err.message : String(err) })
      throw new HttpsError('internal', 'Αποτυχία ανάλυσης απόδειξης.')
    }

    const toolBlock = message.content.find((b) => b.type === 'tool_use')
    if (!toolBlock || toolBlock.type !== 'tool_use') return {}
    const out = toolBlock.input as Record<string, unknown>

    const result: PaymentOcrResult = {}
    if (typeof out.amount === 'number' && isFinite(out.amount) && out.amount >= 0)
      result.amount = Math.round(out.amount * 100) / 100
    if (typeof out.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(out.date)) result.date = out.date
    if (typeof out.method === 'string' && ['cash', 'bank', 'card', 'iris', 'other'].includes(out.method))
      result.method = out.method as Method
    if (typeof out.reference === 'string' && out.reference.trim()) result.reference = out.reference.trim()
    if (typeof out.payerName === 'string' && out.payerName.trim()) result.payerName = out.payerName.trim()

    logger.info('ocrPayment ok', { email, fields: Object.keys(result) })
    return result
  },
)
