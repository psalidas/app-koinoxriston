import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/lib/auth'
import { Button } from '@/components/forms'

export function ProtectedRoute({
  children,
  managerOnly = false,
}: {
  children: ReactNode
  managerOnly?: boolean
}) {
  const { loading, user, hasAccess, isManager, signOut, authIdentifier, authReason } = useAuth()

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-gray-400">
        Φόρτωση…
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  if (!hasAccess) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-2 px-6 text-center">
        <h1 className="text-lg font-semibold text-gray-900">Δεν έχετε πρόσβαση</h1>
        <p className="max-w-sm text-sm text-gray-500">
          Ο λογαριασμός σας δεν έχει ενεργοποιηθεί. Επικοινωνήστε με τον
          διαχειριστή της πολυκατοικίας.
        </p>
        {user.email && (
          <p className="text-xs text-gray-400">Συνδεδεμένος ως {user.email}</p>
        )}
        <div className="mt-1 rounded-md bg-gray-50 px-3 py-2 text-left text-[11px] leading-relaxed text-gray-400">
          <div>Αναγνωριστικό ελέγχου: <span className="font-mono text-gray-600">{authIdentifier || '—'}</span></div>
          <div>
            Κατάσταση:{' '}
            <span className="font-mono text-gray-600">
              {authReason === 'not-found'
                ? 'δεν βρέθηκε λογαριασμός με αυτό το αναγνωριστικό'
                : authReason === 'denied'
                ? 'άρνηση ανάγνωσης (δικαιώματα)'
                : authReason === 'error'
                ? 'σφάλμα ανάγνωσης'
                : 'ανενεργός λογαριασμός'}
            </span>
          </div>
        </div>
        <Button variant="secondary" onClick={() => void signOut()} className="mt-2">
          Αποσύνδεση / Δοκιμή άλλου λογαριασμού
        </Button>
      </div>
    )
  }

  if (managerOnly && !isManager) {
    return <Navigate to="/portal" replace />
  }

  return <>{children}</>
}
