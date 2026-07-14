import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { LogIn, Send, ArrowLeft, KeyRound } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { isFirebaseConfigured } from '@/lib/firebase'
import { Button, TextField } from '@/components/forms'

const isEmail = (s: string) => s.includes('@')

function friendlyError(e: unknown): string {
  const code = (e as { code?: string })?.code ?? ''
  if (code.includes('wrong-password') || code.includes('invalid-credential') || code.includes('user-not-found')) {
    return 'Λάθος στοιχεία ή δεν έχετε ορίσει κωδικό. Δοκιμάστε «Σύνδεσμο εισόδου».'
  }
  if (code.includes('too-many-requests')) {
    return 'Πολλές προσπάθειες. Δοκιμάστε αργότερα ή με σύνδεσμο εισόδου.'
  }
  return (e as Error).message || 'Κάτι πήγε στραβά.'
}

export default function Login() {
  const { user, loading, signInWithGoogle, sendMagicLink, signInWithPassword } = useAuth()
  const [step, setStep] = useState<'id' | 'email'>('id')
  const [identifier, setIdentifier] = useState('')
  const [usePassword, setUsePassword] = useState(false)
  const [password, setPassword] = useState('')
  const [sent, setSent] = useState<'email' | 'sms' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (!loading && user) return <Navigate to="/" replace />

  const email = identifier.trim().toLowerCase()

  async function google() {
    setError(null)
    try {
      await signInWithGoogle()
    } catch (e) {
      setError(friendlyError(e))
    }
  }

  async function magic() {
    setError(null)
    setBusy(true)
    try {
      await sendMagicLink(identifier.trim())
      setSent(isEmail(identifier) ? 'email' : 'sms')
    } catch (e) {
      setError(friendlyError(e))
    } finally {
      setBusy(false)
    }
  }

  async function onContinue(ev: React.FormEvent) {
    ev.preventDefault()
    if (!identifier.trim()) return
    setError(null)
    if (isEmail(identifier)) {
      setStep('email')
    } else {
      await magic() // κινητό → SMS σύνδεσμος κατευθείαν
    }
  }

  async function loginPassword(ev: React.FormEvent) {
    ev.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await signInWithPassword(email, password)
    } catch (e) {
      setError(friendlyError(e))
    } finally {
      setBusy(false)
    }
  }

  function reset() {
    setStep('id')
    setUsePassword(false)
    setPassword('')
    setSent(null)
    setError(null)
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
            Το Firebase δεν έχει ρυθμιστεί ακόμη (δείτε <code>docs/SETUP.md</code>).
          </div>
        )}

        {error && <div className="mb-4 rounded-md bg-red-50 p-3 text-xs text-red-700">{error}</div>}

        {sent ? (
          <div className="space-y-4">
            <div className="rounded-md bg-green-50 p-3 text-sm text-green-700">
              Στείλαμε <strong>σύνδεσμο εισόδου</strong> {sent === 'sms' ? 'με SMS' : 'στο email σας'}. Ανοίξτε
              τον για να μπείτε (ισχύει 1 ώρα).
            </div>
            <button onClick={reset} className="text-sm text-gray-500 hover:text-gray-700">
              ← Πίσω
            </button>
          </div>
        ) : step === 'id' ? (
          <>
            <Button variant="secondary" onClick={google} disabled={!isFirebaseConfigured} className="w-full">
              <LogIn size={18} /> Είσοδος με Google
            </Button>
            <div className="my-4 flex items-center gap-3 text-xs text-gray-400">
              <div className="h-px flex-1 bg-gray-200" /> ή <div className="h-px flex-1 bg-gray-200" />
            </div>
            <form onSubmit={onContinue} className="space-y-3">
              <TextField
                required
                placeholder="Email ή κινητό (π.χ. +30690…)"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                disabled={!isFirebaseConfigured}
              />
              <Button type="submit" disabled={!isFirebaseConfigured || busy} className="w-full">
                {busy ? 'Παρακαλώ…' : 'Συνέχεια'}
              </Button>
            </form>
          </>
        ) : (
          // step === 'email'
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="truncate font-medium text-gray-800">{email}</span>
              <button onClick={reset} className="inline-flex items-center gap-1 text-gray-400 hover:text-gray-600">
                <ArrowLeft size={14} /> Αλλαγή
              </button>
            </div>

            <Button onClick={magic} disabled={busy} className="w-full">
              <Send size={18} /> {busy ? 'Αποστολή…' : 'Στείλε μου σύνδεσμο εισόδου'}
            </Button>

            {!usePassword ? (
              <button
                onClick={() => setUsePassword(true)}
                className="flex w-full items-center justify-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
              >
                <KeyRound size={14} /> Είσοδος με κωδικό
              </button>
            ) : (
              <form onSubmit={loginPassword} className="space-y-2 rounded-md border border-gray-200 p-3">
                <TextField
                  type="password"
                  required
                  autoFocus
                  placeholder="Κωδικός"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <Button type="submit" variant="secondary" disabled={busy} className="w-full">
                  <KeyRound size={16} /> Είσοδος
                </Button>
                <button
                  type="button"
                  onClick={magic}
                  className="w-full text-center text-xs text-gray-400 hover:text-gray-600"
                >
                  Ξέχασα τον κωδικό — στείλε σύνδεσμο εισόδου
                </button>
              </form>
            )}
          </div>
        )}

        <p className="mt-4 text-center text-xs text-gray-400">
          Πρόσβαση μόνο με πρόσκληση από τον διαχειριστή.
        </p>
      </div>
    </div>
  )
}
