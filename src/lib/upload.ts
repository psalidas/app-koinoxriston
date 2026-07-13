import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage'
import { storage } from './firebase'

function sanitize(name: string): string {
  return name.replace(/[^\w.\-]+/g, '_').slice(-80)
}

const MB = 1024 * 1024
/** Όρια μεγέθους — πρέπει να συμφωνούν με τα storage.rules (250MB παντού). */
export const RECEIPT_MAX_BYTES = 250 * MB
export const DOCUMENT_MAX_BYTES = 250 * MB

export interface UploadedFile {
  url: string
  name: string
  path: string
}

/** Progress callback: 0–100. */
export type ProgressFn = (percent: number) => void

function checkSize(file: File, max: number): void {
  if (file.size > max) {
    throw new Error(
      `Το αρχείο «${file.name}» είναι πολύ μεγάλο (${(file.size / MB).toFixed(1)} MB). ` +
        `Μέγιστο επιτρεπτό: ${Math.round(max / MB)} MB.`,
    )
  }
}

/** Resumable upload with progress reporting; resolves to the download info. */
async function uploadTo(path: string, file: File, onProgress?: ProgressFn): Promise<UploadedFile> {
  if (!storage) throw new Error('Το Firebase Storage δεν έχει ρυθμιστεί.')
  const task = uploadBytesResumable(ref(storage, path), file, { contentType: file.type })
  await new Promise<void>((resolve, reject) => {
    task.on(
      'state_changed',
      (snap) => {
        const pct = snap.totalBytes ? Math.round((snap.bytesTransferred / snap.totalBytes) * 100) : 0
        onProgress?.(pct)
      },
      reject,
      resolve,
    )
  })
  const url = await getDownloadURL(task.snapshot.ref)
  return { url, name: file.name, path }
}

/** Upload a receipt/photo under receipts/{buildingId}/{ts}-{name}. */
export async function uploadReceipt(
  file: File,
  buildingId: string,
  onProgress?: ProgressFn,
): Promise<UploadedFile> {
  checkSize(file, RECEIPT_MAX_BYTES)
  const stamp = `${Date.now()}-${Math.round(Math.random() * 1e6)}`
  return uploadTo(`receipts/${buildingId}/${stamp}-${sanitize(file.name)}`, file, onProgress)
}

/** Upload a building document under documents/{buildingId}/{ts}-{name}. */
export async function uploadDocument(
  file: File,
  buildingId: string,
  onProgress?: ProgressFn,
): Promise<UploadedFile> {
  checkSize(file, DOCUMENT_MAX_BYTES)
  const stamp = `${Date.now()}-${Math.round(Math.random() * 1e6)}`
  return uploadTo(`documents/${buildingId}/${stamp}-${sanitize(file.name)}`, file, onProgress)
}

export async function deleteFile(path: string): Promise<void> {
  if (!storage) return
  try {
    await deleteObject(ref(storage, path))
  } catch (err) {
    console.error('delete file failed', err)
  }
}
