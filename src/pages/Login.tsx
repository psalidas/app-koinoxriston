import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { LogIn, Send } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { isFirebaseConfigured } from '@/lib/firebase'
import { Button, TextField } from '@/components/forms'

export default function Login() {
  const { user, loading, signInWithGoogle, sendMagicLink } = useAuth()
  const [identifier, setIdentifier] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (!loading && user) return <Navigate to="/" replace />

  async function google() {
    setError(null)
    try {
      await signInWithGoogle()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function magic(ev: React.FormEvent) {
    ev.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await sendMagicLink(identifier.trim())
      setSent(true)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-blue-50 to-gray-50 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <img src="/icon.svg" alt="" className="h-14 w-14 rounded-xl" />
          <h1 className="text-lg font-semibold text-gray-900">Διαχείριση Πολυκατοικίας</h1>
          <p className="text-sm text-gray-500">Συνδεθείτε για να συνεχίσετε</p>
        </div>

        {!isFirebaseConfigured && (
          <div className="mb-4 rounded-md bg-amber-50 p-3 text-xs text-amber-700">
            Το Firebase δεν έχει ρυθμιστεί ακόμη. Συμπληρώστε το αρχείο <code>.env</code>{' '}
            (δείτε <code>docs/SETUP.md</code>).
          </div>
        )}

        {error && <div className="mb-4 rounded-md bg-red-50 p-3 text-xs text-red-700">{error}</div>}

        <Button variant="secondary" onClick={google} disabled={!isFirebaseConfigured} className="w-full">
          <LogIn size={18} /> Είσοδος με Google
        </Button>

        <div className="my-4 flex items-center gap-3 text-xs text-gray-400">
          <div className="h-px flex-1 bg-gray-200" /> ή <div className="h-px flex-1 bg-gray-200" />
        </div>

        {sent ? (
          <div className="rounded-md bg-green-50 p-3 text-sm text-green-700">
            Αν το στοιχείο αντιστοιχεί σε λογαριασμό, στείλαμε <strong>σύνδεσμο εισόδου</strong> με
            email ή SMS. Ανοίξτε τον για να μπείτε (ισχύει 1 ώρα).
          </div>
        ) : (
          <form onSubmit={magic} className="space-y-3">
            <TextField
              required
              placeholder="Email ή κινητό (π.χ. +30690…)"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              disabled={!isFirebaseConfigured}
            />
            <Button type="submit" disabled={!isFirebaseConfigured || busy} className="w-full">
              <Send size={18} /> {busy ? 'Αποστολή…' : 'Αποστολή συνδέσμου εισόδου'}
            </Button>
          </form>
        )}

        <p className="mt-4 text-center text-xs text-gray-400">
          Πρόσβαση μόνο με πρόσκληση από τον διαχειριστή.
        </p>
      </div>
    </div>
  )
}
