import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
import { storage } from './firebase'

function sanitize(name: string): string {
  return name.replace(/[^\w.\-]+/g, '_').slice(-80)
}

export interface UploadedFile {
  url: string
  name: string
  path: string
}

/** Upload a receipt/document under receipts/{buildingId}/{ts}-{name}. */
export async function uploadReceipt(
  file: File,
  buildingId: string,
): Promise<UploadedFile> {
  if (!storage) throw new Error('Το Firebase Storage δεν έχει ρυθμιστεί.')
  const stamp = `${Date.now()}-${Math.round(Math.random() * 1e6)}`
  const path = `receipts/${buildingId}/${stamp}-${sanitize(file.name)}`
  const r = ref(storage, path)
  await uploadBytes(r, file, { contentType: file.type })
  const url = await getDownloadURL(r)
  return { url, name: file.name, path }
}

export async function deleteFile(path: string): Promise<void> {
  if (!storage) return
  try {
    await deleteObject(ref(storage, path))
  } catch (err) {
    console.error('delete file failed', err)
  }
}
