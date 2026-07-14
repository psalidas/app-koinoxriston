import { httpsCallable } from 'firebase/functions'
import { functions } from './firebase'

export interface OcrResult {
  merchant?: string
  documentNumber?: string
  date?: string
  amount?: number
  category?: string
  currency?: string
}

/** Διαβάζει αρχείο ως base64 (χωρίς το data: prefix). */
function readBase64(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const s = String(reader.result)
      resolve(s.slice(s.indexOf(',') + 1))
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

/**
 * Ετοιμάζει αρχείο για OCR. Οι εικόνες γίνονται downscale/JPEG ώστε να μένουν
 * κάτω από το όριο μεγέθους· τα PDF στέλνονται ως έχουν.
 */
async function prepare(file: File): Promise<{ base64: string; mediaType: string }> {
  if (file.type === 'application/pdf') {
    return { base64: await readBase64(file), mediaType: 'application/pdf' }
  }
  // image → downscale σε max 1600px, JPEG 0.8
  try {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const r = new FileReader()
      r.onload = () => resolve(String(r.result))
      r.onerror = () => reject(r.error)
      r.readAsDataURL(file)
    })
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image()
      i.onload = () => resolve(i)
      i.onerror = () => reject(new Error('bad image'))
      i.src = dataUrl
    })
    const max = 1600
    const scale = Math.min(1, max / Math.max(img.width, img.height))
    const w = Math.max(1, Math.round(img.width * scale))
    const h = Math.max(1, Math.round(img.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('no canvas')
    ctx.drawImage(img, 0, 0, w, h)
    const out = canvas.toDataURL('image/jpeg', 0.8)
    return { base64: out.slice(out.indexOf(',') + 1), mediaType: 'image/jpeg' }
  } catch {
    // fallback: στείλε το αρχικό
    return { base64: await readBase64(file), mediaType: file.type || 'image/jpeg' }
  }
}

/** Ανάλυση παραστατικού με AI· επιστρέφει δομημένα πεδία για προσυμπλήρωση. */
export async function analyzeReceipt(file: File): Promise<OcrResult> {
  if (!functions) throw new Error('Το Firebase δεν έχει ρυθμιστεί.')
  const { base64, mediaType } = await prepare(file)
  const fn = httpsCallable<{ imageBase64: string; mediaType: string }, OcrResult>(functions, 'ocrReceipt')
  return (await fn({ imageBase64: base64, mediaType })).data
}
