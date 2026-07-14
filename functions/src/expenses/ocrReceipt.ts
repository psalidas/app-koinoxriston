// AI προσυμπλήρωση παραστατικού δαπάνης με Claude vision (Haiku 4.5).
//
// Callable: δέχεται εικόνα/PDF παραστατικού (base64) και επιστρέφει δομημένα
// πεδία (προμηθευτής, ημ/νία, ποσό, κατηγορία…) που προσυμπληρώνουν τη φόρμα
// δαπάνης. API key server-side από env `ANTHROPIC_API_KEY` (GitHub Secret → CI).
// Δομημένη έξοδος μέσω forced tool-use.

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

interface OcrResult {
  merchant?: string
  documentNumber?: string
  date?: string // ISO YYYY-MM-DD
  amount?: number // τελικό σύνολο με ΦΠΑ
  category?: string
  currency?: string
}

const EXTRACT_TOOL = {
  name: 'extract_receipt',
  description: 'Καταγράφει τα δομημένα πεδία ενός παραστατικού δαπάνης από την εικόνα.',
  input_schema: {
    type: 'object' as const,
    properties: {
      merchant: { type: 'string', description: 'Επωνυμία προμηθευτή/καταστήματος όπως εμφανίζεται.' },
      documentNumber: { type: 'string', description: 'Αριθμός παραστατικού (Νο./Αρ. απόδειξης ή τιμολογίου).' },
      date: { type: 'string', description: 'Ημερομηνία παραστατικού σε μορφή ISO YYYY-MM-DD.' },
      amount: { type: 'number', description: 'Συνολικό τελικό ποσό με ΦΠΑ.' },
      category: {
        type: 'string',
        description:
          'Σύντομη κατηγορία δαπάνης πολυκατοικίας στα ελληνικά (π.χ. ΔΕΗ κοινοχρήστων, ' +
          'καθαρισμός, ανελκυστήρας, ύδρευση, συντήρηση καυστήρα, αναλώσιμα).',
      },
      currency: { type: 'string', description: 'Νόμισμα ISO 4217 (π.χ. EUR). Κενό αν δεν φαίνεται.' },
    },
    required: [],
  },
}

export const ocrReceipt = onCall(
  { invoker: 'public' },
  async (request): Promise<OcrResult> => {
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
        tool_choice: { type: 'tool', name: 'extract_receipt' },
        messages: [
          {
            role: 'user',
            content: [
              fileBlock,
              {
                type: 'text',
                text:
                  'Διάβασε αυτό το παραστατικό δαπάνης και κάλεσε το εργαλείο extract_receipt ' +
                  'με όσα πεδία διαβάζεις με βεβαιότητα. Άφησε κενό ό,τι δεν φαίνεται καθαρά. ' +
                  'Το amount είναι το τελικό σύνολο με ΦΠΑ.',
              },
            ],
          },
        ],
      })
    } catch (err) {
      logger.error('ocrReceipt: Anthropic call failed', { err: err instanceof Error ? err.message : String(err) })
      throw new HttpsError('internal', 'Αποτυχία ανάλυσης παραστατικού.')
    }

    const toolBlock = message.content.find((b) => b.type === 'tool_use')
    if (!toolBlock || toolBlock.type !== 'tool_use') return {}
    const out = toolBlock.input as Record<string, unknown>

    const result: OcrResult = {}
    if (typeof out.merchant === 'string' && out.merchant.trim()) result.merchant = out.merchant.trim()
    if (typeof out.documentNumber === 'string' && out.documentNumber.trim())
      result.documentNumber = out.documentNumber.trim()
    if (typeof out.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(out.date)) result.date = out.date
    if (typeof out.amount === 'number' && isFinite(out.amount) && out.amount >= 0)
      result.amount = Math.round(out.amount * 100) / 100
    if (typeof out.category === 'string' && out.category.trim()) result.category = out.category.trim()
    if (typeof out.currency === 'string') {
      const code = out.currency.trim().toUpperCase()
      if (/^[A-Z]{3}$/.test(code)) result.currency = code
    }

    logger.info('ocrReceipt ok', { email, fields: Object.keys(result) })
    return result
  },
)
