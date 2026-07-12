import {
  addDoc,
  collection,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from './firebase'

interface LogInput {
  buildingId?: string
  userEmail: string
  userName: string
  action: string
  entity: string
  entityId: string
  before?: Record<string, unknown>
  after?: Record<string, unknown>
  context?: Record<string, unknown>
}

/** Write one audit-log entry. Best-effort: never throws into the UI. */
export async function logAudit(input: LogInput): Promise<void> {
  if (!db) return
  try {
    await addDoc(collection(db, 'auditLogs'), {
      ...stripUndefined(input as unknown as Record<string, unknown>),
      timestamp: serverTimestamp(),
    })
  } catch (err) {
    console.error('audit log failed', err)
  }
}

function stripUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v
  }
  return out as Partial<T>
}
