import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { LogIn, Mail, Smartphone } from 'lucide-react'
import type { ConfirmationResult } from 'firebase/auth'
import { useAuth } from '@/lib/auth'
import { isFirebaseConfigured } from '@/lib/firebase'
import { Button, TextField } from '@/components/forms'

type Mode = 'email' | 'phone'

export default function Login() {
  const { user, loading, signInWithGoogle, sendEmailLink, sendPhoneOtp } = useAuth()
  const [mode, setMode] = useState<Mode>('email')
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null)
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

  async function emailLink(ev: React.FormEvent) {
    ev.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await sendEmailLink(email.trim())
      setSent(true)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function sendCode(ev: React.FormEvent) {
    ev.preventDefault()
    setError(null)
    setBusy(true)
    try {
      let normalized = phone.trim().replace(/\s+/g, '')
      if (!normalized.startsWith('+')) normalized = '+30' + normalized // default Greece
      const result = await sendPhoneOtp(normalized, 'recaptcha-container')
      setConfirmation(result)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function confirmCode(ev: React.FormEvent) {
    ev.preventDefault()
    if (!confirmation) return
    setError(null)
    setBusy(true)
    try {
      await confirmation.confirm(otp.trim())
    } catch (e) {
      setError('Λάθος κωδικός. ' + (e as Error).message)
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

        {/* Method tabs */}
        <div className="mb-4 grid grid-cols-2 gap-1 rounded-lg bg-gray-100 p-1 text-sm">
          <button
            onClick={() => setMode('email')}
            className={`flex items-center justify-center gap-1.5 rounded-md py-1.5 font-medium ${
              mode === 'email' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
            }`}
          >
            <Mail size={16} /> Email
          </button>
          <button
            onClick={() => setMode('phone')}
            className={`flex items-center justify-center gap-1.5 rounded-md py-1.5 font-medium ${
              mode === 'phone' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
            }`}
          >
            <Smartphone size={16} /> Κινητό
          </button>
        </div>

        {mode === 'email' &&
          (sent ? (
            <div className="rounded-md bg-green-50 p-3 text-sm text-green-700">
              Στείλαμε σύνδεσμο εισόδου στο <strong>{email}</strong>. Ανοίξτε το email σας από
              αυτή τη συσκευή.
            </div>
          ) : (
            <form onSubmit={emailLink} className="space-y-3">
              <TextField
                type="email"
                required
                placeholder="Το email σας"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={!isFirebaseConfigured}
              />
              <Button type="submit" disabled={!isFirebaseConfigured || busy} className="w-full">
                <Mail size={18} /> Αποστολή συνδέσμου εισόδου
              </Button>
            </form>
          ))}

        {mode === 'phone' &&
          (confirmation ? (
            <form onSubmit={confirmCode} className="space-y-3">
              <TextField
                inputMode="numeric"
                required
                placeholder="Κωδικός SMS (6 ψηφία)"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
              />
              <Button type="submit" disabled={busy} className="w-full">
                Επιβεβαίωση κωδικού
              </Button>
              <button
                type="button"
                onClick={() => setConfirmation(null)}
                className="w-full text-center text-xs text-gray-400 hover:text-gray-600"
              >
                Αλλαγή αριθμού
              </button>
            </form>
          ) : (
            <form onSubmit={sendCode} className="space-y-3">
              <TextField
                type="tel"
                required
                placeholder="Κινητό (π.χ. 6941234567)"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={!isFirebaseConfigured}
              />
              <Button type="submit" disabled={!isFirebaseConfigured || busy} className="w-full">
                <Smartphone size={18} /> Αποστολή κωδικού SMS
              </Button>
            </form>
          ))}

        <div id="recaptcha-container" />

        <p className="mt-4 text-center text-xs text-gray-400">
          Πρόσβαση μόνο με πρόσκληση από τον διαχειριστή.
        </p>
      </div>
    </div>
  )
}
