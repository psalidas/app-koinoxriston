// Κοινός έλεγχος διαχειριστή για τα callables προσκλήσεων.

import { HttpsError } from 'firebase-functions/v2/https'

const BOOTSTRAP_ADMIN_EMAIL = 'michael@crowdpolicy.com'

export async function requireManager(
  db: FirebaseFirestore.Firestore,
  auth: { token?: { email?: string } } | undefined,
): Promise<string> {
  const email = auth?.token?.email?.toLowerCase()
  if (!email) throw new HttpsError('unauthenticated', 'Δεν είστε συνδεδεμένος.')
  if (email === BOOTSTRAP_ADMIN_EMAIL) return email
  const snap = await db.doc(`users/${email}`).get()
  const role = snap.exists ? (snap.data()?.role as string | undefined) : undefined
  if (role !== 'admin' && role !== 'manager') {
    throw new HttpsError('permission-denied', 'Απαιτείται ρόλος διαχειριστή.')
  }
  return email
}
